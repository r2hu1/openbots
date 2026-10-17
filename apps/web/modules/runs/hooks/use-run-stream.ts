"use client"

import * as React from "react"
import type { RunStatus, StepItem } from "../types"
import {
  dispatchSseMessage,
  type StreamCallbacks,
} from "./use-run-stream-dispatcher"
import {
  fetchRunTerminalFallback,
  getStreamAuthHeaders,
} from "./use-run-stream-transport"

export interface UseRunStreamOptions {
  runId: string | null
  onDelta?: (deltaText: string, fullText: string) => void
  onToolStart?: (step: { toolName: string; stepNumber: number }) => void
  onToolFinish?: (step: { toolName: string; stepNumber: number }) => void
  onStatus?: (data: {
    status: RunStatus
    error?: string
    output?: any
    steps?: StepItem[]
  }) => void
  onDone?: (data: { status: RunStatus; output?: any }) => void
  onError?: (err: Error) => void
}

export function useRunStream({
  runId,
  onDelta,
  onToolStart,
  onToolFinish,
  onStatus,
  onDone,
  onError,
}: UseRunStreamOptions) {
  const [streamingText, setStreamingText] = React.useState<string>("")
  const [streamingSteps, setStreamingSteps] = React.useState<StepItem[]>([])
  const [isStreaming, setIsStreaming] = React.useState(false)
  const [status, setStatus] = React.useState<RunStatus | null>(null)

  const accTextRef = React.useRef("")
  const rafRef = React.useRef<number | null>(null)

  const flushText = React.useCallback(() => {
    rafRef.current = null
    setStreamingText(accTextRef.current)
  }, [])

  const scheduleFlush = React.useCallback(() => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushText)
    }
  }, [flushText])

  const callbacksRef = React.useRef<StreamCallbacks>({
    onDelta,
    onToolStart,
    onToolFinish,
    onStatus,
    onDone,
  })
  callbacksRef.current = { onDelta, onToolStart, onToolFinish, onStatus, onDone }
  const onErrorRef = React.useRef(onError)
  onErrorRef.current = onError

  React.useEffect(() => {
    if (!runId) {
      accTextRef.current = ""
      setStreamingText("")
      setStreamingSteps([])
      setIsStreaming(false)
      setStatus(null)
      return
    }

    const abortController = new AbortController()
    let isTerminated = false
    accTextRef.current = ""
    let retryCount = 0
    const MAX_RETRIES = 4
    let retryTimeout: ReturnType<typeof setTimeout> | null = null
    const seqTracker = { lastSeenSeq: -1 }

    setStreamingText("")
    setStreamingSteps([])
    setIsStreaming(true)
    setStatus("running")

    const connect = async () => {
      try {
        const apiBaseUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
        const res = await fetch(`${apiBaseUrl}/api/runs/${runId}/stream`, {
          method: "GET",
          headers: getStreamAuthHeaders(),
          credentials: "include",
          signal: abortController.signal,
        })

        if (!res.ok) {
          if (res.status === 404 && retryCount < 2) {
            retryCount++
            retryTimeout = setTimeout(connect, 600)
            return
          }
          throw new Error(`Failed to connect to run stream: ${res.statusText}`)
        }

        if (!res.body) {
          throw new Error("No response body received from stream")
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (!abortController.signal.aborted && !isTerminated) {
          const { done, value } = await reader.read()
          if (done) break

          retryCount = 0
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n")
          const messages = buffer.split("\n\n")
          buffer = messages.pop() ?? ""

          for (const rawMessage of messages) {
            dispatchSseMessage(rawMessage, {
              lastSeenSeq: seqTracker.lastSeenSeq,
              accTextRef,
              scheduleFlush,
              callbacksRef,
              setStreamingSteps,
              setStatus,
              setStreamingText,
              setIsStreaming,
              markTerminated: () => {
                isTerminated = true
              },
            })
          }
        }

        if (!abortController.signal.aborted && !isTerminated) {
          if (retryCount < MAX_RETRIES) {
            retryCount++
            const delay = Math.min(800 * Math.pow(1.5, retryCount), 3000)
            retryTimeout = setTimeout(connect, delay)
            return
          }
        }
      } catch (err: any) {
        if (
          err.name === "AbortError" ||
          abortController.signal.aborted ||
          isTerminated
        ) {
          return
        }

        if (retryCount < MAX_RETRIES) {
          retryCount++
          const delay = Math.min(800 * Math.pow(1.5, retryCount), 3000)
          retryTimeout = setTimeout(connect, delay)
          return
        }

        const fallback = await fetchRunTerminalFallback(
          runId,
          abortController.signal
        )
        if (fallback) {
          const { run, steps } = fallback
          isTerminated = true
          setStatus(run.status)
          const finalText =
            (run.output as Record<string, any> | undefined)?.text ||
            accTextRef.current
          if (finalText) setStreamingText(finalText)
          if (steps) setStreamingSteps(steps)
          callbacksRef.current.onStatus?.({
            status: run.status,
            output: run.output,
            error: run.error ?? undefined,
          })
          callbacksRef.current.onDone?.({
            status: run.status,
            output: run.output,
          })
          return
        }

        setIsStreaming(false)
        onErrorRef.current?.(err)
      } finally {
        if (!abortController.signal.aborted && isTerminated) {
          setIsStreaming(false)
        }
      }
    }

    connect()

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      abortController.abort()
    }
  }, [runId, scheduleFlush])

  return {
    streamingText,
    streamingSteps,
    isStreaming,
    status,
    resetStream: () => {
      accTextRef.current = ""
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      setStreamingText("")
      setStreamingSteps([])
      setIsStreaming(false)
    },
  }
}
