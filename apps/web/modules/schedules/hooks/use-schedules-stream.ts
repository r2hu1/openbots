"use client"

import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { scheduleKeys } from "../queries"

export function useSchedulesStream({ enabled = true }: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient()

  React.useEffect(() => {
    if (!enabled) return

    const abortController = new AbortController()
    let reconnectTimer: any = null

    const connect = async () => {
      try {
        const apiBaseUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
        const url = `${apiBaseUrl}/api/schedules/stream`

        const headers: Record<string, string> = {
          Accept: "text/event-stream",
        }
        if (typeof window !== "undefined") {
          const token =
            localStorage.getItem("bearer_token") ||
            localStorage.getItem("better-auth_token")
          if (token) {
            headers.Authorization = `Bearer ${token}`
          }
        }

        const response = await fetch(url, {
          headers,
          signal: abortController.signal,
          credentials: "include",
        })

        if (!response.ok || !response.body) {
          reconnectTimer = setTimeout(connect, 3000)
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (!abortController.signal.aborted) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n\n")
          buffer = lines.pop() || ""

          for (const block of lines) {
            if (!block.trim()) continue
            const blockLines = block.split("\n")
            let eventType = "message"
            let dataStr = ""

            for (const line of blockLines) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim()
              } else if (line.startsWith("data: ")) {
                dataStr = line.slice(6).trim()
              }
            }

            if (eventType === "schedule" && dataStr) {
              try {
                const event = JSON.parse(dataStr)
                queryClient.invalidateQueries({ queryKey: scheduleKeys.all })
                if (event.agentId) {
                  queryClient.invalidateQueries({
                    queryKey: scheduleKeys.byAgent(event.agentId),
                  })
                }
              } catch {}
            }
          }
        }
      } catch (err: any) {
        if (!abortController.signal.aborted) {
          reconnectTimer = setTimeout(connect, 3000)
        }
      }
    }

    connect()

    return () => {
      abortController.abort()
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [enabled, queryClient])
}
