import type { MutableRefObject } from "react"
import type { RunStatus, StepItem } from "../types"
import { applyToolFinish, applyToolStart } from "./use-run-stream-reducer"
import { parseSseBlock } from "./use-run-stream-transport"

export interface StreamCallbacks {
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
}

export interface DispatchContext {
  lastSeenSeq: number
  accTextRef: MutableRefObject<string>
  scheduleFlush: () => void
  callbacksRef: MutableRefObject<StreamCallbacks>
  setStreamingSteps: React.Dispatch<React.SetStateAction<StepItem[]>>
  setStatus: React.Dispatch<React.SetStateAction<RunStatus | null>>
  setStreamingText: React.Dispatch<React.SetStateAction<string>>
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>
  markTerminated: () => void
}

export function dispatchSseMessage(
  rawMessage: string,
  ctx: DispatchContext
): void {
  const parsed = parseSseBlock(rawMessage)
  if (!parsed) return
  const { eventType, dataStr } = parsed

  try {
    const data = JSON.parse(dataStr)

    if (typeof data.seq === "number") {
      if (data.seq <= ctx.lastSeenSeq) return
      ctx.lastSeenSeq = data.seq
    }

    if (eventType === "delta") {
      const chunk = data.text ?? ""
      if (chunk) {
        ctx.accTextRef.current += chunk
        ctx.scheduleFlush()
        ctx.callbacksRef.current.onDelta?.(chunk, ctx.accTextRef.current)
      }
    } else if (eventType === "tool_start") {
      ctx.setStreamingSteps((prev) => applyToolStart(prev, data))
      ctx.callbacksRef.current.onToolStart?.(data)
    } else if (eventType === "tool_finish") {
      ctx.setStreamingSteps((prev) => applyToolFinish(prev, data))
      ctx.callbacksRef.current.onToolFinish?.(data)
    } else if (eventType === "status") {
      const nextStatus = data.status as RunStatus
      ctx.setStatus(nextStatus)
      if (Array.isArray(data.steps) && data.steps.length > 0) {
        ctx.setStreamingSteps(data.steps)
      }
      if (!ctx.accTextRef.current && data.output?.text) {
        ctx.accTextRef.current = data.output.text
        ctx.setStreamingText(ctx.accTextRef.current)
      }
      ctx.callbacksRef.current.onStatus?.(data)

      if (
        nextStatus === "completed" ||
        nextStatus === "failed" ||
        nextStatus === "cancelled"
      ) {
        ctx.markTerminated()
        ctx.setIsStreaming(false)
      }
    } else if (eventType === "done") {
      ctx.markTerminated()
      ctx.setIsStreaming(false)
      ctx.setStatus((data.status as RunStatus) || "completed")
      if (!ctx.accTextRef.current && data.output?.text) {
        ctx.accTextRef.current = data.output.text
        ctx.setStreamingText(ctx.accTextRef.current)
      }
      ctx.callbacksRef.current.onDone?.(data)
    }
  } catch (jsonErr) {
    console.warn("Failed to parse SSE JSON payload:", jsonErr)
  }
}
