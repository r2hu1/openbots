"use client"

import { toast } from "@openbots/ui/components/toast"
import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { playRunAudioCue } from "@/lib/audio-cues"
import { agentKeys } from "../queries"
import { scheduleKeys } from "@/modules/schedules/queries"
import { runKeys } from "@/modules/runs/queries"
import type { Agent } from "../types"

export interface WorkspaceStreamEvent {
  type:
    | "run_created"
    | "run_status"
    | "schedule_fired"
    | "schedule_updated"
    | "agent_updated"
  agentId: string
  runId?: string
  status?: string
  error?: string
  output?: any
  lastMessage?: string | null
  conversationId?: string | null
  run?: any
}

interface UseWorkspaceStreamOptions {
  enabled?: boolean
}

export function useWorkspaceStream({
  enabled = true,
}: UseWorkspaceStreamOptions = {}) {
  const queryClient = useQueryClient()

  const [activeAgentStatuses, setActiveAgentStatuses] = React.useState<
    Record<string, string>
  >({})

  React.useEffect(() => {
    if (!enabled) return

    const abortController = new AbortController()
    let reconnectTimer: any = null

    let retryCount = 0

    const connect = async () => {
      try {
        const apiBaseUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
        const url = `${apiBaseUrl}/api/agents/stream`

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

        // Reset active statuses on each new connection — the server will
        // re-emit `run_status: running` for any genuinely active runs during
        // initial hydration. Without this, a dropped connection that missed
        // the `run_status: completed` event leaves stale "running" entries
        // that never get cleared.
        setActiveAgentStatuses({})

        const res = await fetch(url, {
          method: "GET",
          headers,
          credentials: "include",
          signal: abortController.signal,
        })

        if (!res.ok || !res.body) {
          throw new Error(
            `Failed to connect to workspace stream: ${res.statusText}`
          )
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let lastSeenSeq = -1

        // Connection succeeded — reset backoff
        retryCount = 0

        while (!abortController.signal.aborted) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n\n")
          buffer = lines.pop() || ""

          for (const chunk of lines) {
            if (!chunk.trim()) continue
            const eventLines = chunk.split("\n")
            let eventType = "message"
            let rawData = ""

            for (const line of eventLines) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim()
              } else if (line.startsWith("data: ")) {
                rawData = line.slice(6).trim()
              }
            }

            if (eventType === "ping" || !rawData) continue

            try {
              const data = JSON.parse(rawData)

              if (data.seq !== undefined) {
                if (data.seq <= lastSeenSeq) continue
                lastSeenSeq = data.seq
              }

              const agentId = data.agentId || data.run?.agentId
              if (!agentId) continue

              const status = data.status || data.run?.status

              if (eventType === "run_created" || data.type === "run_created") {
                setActiveAgentStatuses((prev) => ({
                  ...prev,
                  [agentId]: "running",
                }))

                // Extract potential input text for instant preview in lastMessage
                const runInput = data.run?.input
                const prompt =
                  typeof runInput === "string"
                    ? runInput
                    : runInput?.text || runInput?.prompt

                if (prompt) {
                  queryClient.setQueryData<Agent[]>(agentKeys.all, (old) => {
                    if (!old) return old
                    return old.map((ag) =>
                      ag.id === agentId ? { ...ag, lastMessage: prompt } : ag
                    )
                  })
                }
              } else if (
                eventType === "run_status" ||
                data.type === "run_status"
              ) {
                if (status === "running") {
                  setActiveAgentStatuses((prev) => ({
                    ...prev,
                    [agentId]: "running",
                  }))
                } else if (
                  status === "completed" ||
                  status === "failed" ||
                  status === "cancelled"
                ) {
                  setActiveAgentStatuses((prev) => {
                    const next = { ...prev }
                    delete next[agentId]
                    return next
                  })

                  // Play audio cue for any agent completion or failure across the entire workspace
                  const targetRunId = data.runId || data.run?.id
                  if (status === "completed") {
                    playRunAudioCue(targetRunId, "finish")
                  } else if (status === "failed") {
                    playRunAudioCue(targetRunId, "error")
                  }

                  // If output produced text, update lastMessage immediately
                  const outputText =
                    typeof data.output === "string"
                      ? data.output
                      : data.output?.text || data.output?.message

                  if (outputText) {
                    queryClient.setQueryData<Agent[]>(agentKeys.all, (old) => {
                      if (!old) return old
                      return old.map((ag) =>
                        ag.id === agentId
                          ? { ...ag, lastMessage: outputText }
                          : ag
                      )
                    })
                  } else {
                    // Invalidate all agents list query so sidebar displays fresh state from db
                    queryClient.invalidateQueries({
                      queryKey: agentKeys.all,
                    })
                  }
                }
              } else if (
                eventType === "schedule_fired" ||
                data.type === "schedule_fired"
              ) {
                setActiveAgentStatuses((prev) => ({
                  ...prev,
                  [agentId]: "running",
                }))
                const title = data.name
                  ? `⏰ ${data.name}`
                  : "⏰ Scheduled Task"
                const desc = data.prompt
                  ? data.prompt.slice(0, 100)
                  : "Executing scheduled task..."
                toast.add({
                  title,
                  description: desc,
                  type: "info",
                })
                queryClient.invalidateQueries({ queryKey: scheduleKeys.all })
                queryClient.invalidateQueries({
                  queryKey: scheduleKeys.byAgent(agentId),
                })
                queryClient.invalidateQueries({
                  queryKey: runKeys.byAgent(agentId),
                })
              }
            } catch {}
          }
        }

        // Stream closed: reconnect with backoff
        if (!abortController.signal.aborted) {
          const delay = Math.min(2000 * Math.pow(1.5, retryCount), 15000)
          retryCount++
          reconnectTimer = setTimeout(() => {
            if (!abortController.signal.aborted) {
              connect()
            }
          }, delay)
        }
      } catch {
        if (!abortController.signal.aborted) {
          const delay = Math.min(2000 * Math.pow(1.5, retryCount), 15000)
          retryCount++
          reconnectTimer = setTimeout(() => {
            if (!abortController.signal.aborted) {
              connect()
            }
          }, delay)
        }
      }
    }

    connect()

    return () => {
      abortController.abort()
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [enabled, queryClient])

  return { activeAgentStatuses }
}
