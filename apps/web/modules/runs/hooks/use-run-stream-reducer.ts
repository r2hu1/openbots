import type { StepItem } from "../types"

export interface ToolStartEventPayload {
  toolName: string
  stepNumber?: number
  toolCallId?: string | null
  input?: unknown
}

export interface ToolFinishEventPayload {
  toolName: string
  stepNumber?: number
  toolCallId?: string | null
  output?: unknown
}

export function applyToolStart(
  prev: StepItem[],
  data: ToolStartEventPayload
): StepItem[] {
  const existingIdx = prev.findIndex(
    (s) =>
      (data.toolCallId && s.toolCallId === data.toolCallId) ||
      (data.stepNumber !== undefined && s.stepNumber === data.stepNumber) ||
      (s.toolName === data.toolName && s.status === "running")
  )
  const step: StepItem = {
    stepNumber: data.stepNumber ?? prev.length,
    type: "tool",
    status: "running",
    toolName: data.toolName,
    toolCallId: data.toolCallId ?? null,
    toolInput: data.input ?? null,
    startedAt: new Date(),
  }
  if (existingIdx >= 0) {
    const current = prev[existingIdx]!
    const next = [...prev]
    next[existingIdx] = { ...current, ...step }
    return next
  }
  return [...prev, step]
}

export function applyToolFinish(
  prev: StepItem[],
  data: ToolFinishEventPayload
): StepItem[] {
  const existingIdx = prev.findIndex(
    (s) =>
      (data.toolCallId && s.toolCallId === data.toolCallId) ||
      (data.stepNumber !== undefined && s.stepNumber === data.stepNumber) ||
      (s.toolName === data.toolName && s.status === "running")
  )
  if (existingIdx >= 0) {
    const current = prev[existingIdx]!
    const next = [...prev]
    next[existingIdx] = {
      ...current,
      status: "completed",
      toolCallId: data.toolCallId ?? current.toolCallId,
      toolOutput: data.output ?? current.toolOutput,
      completedAt: new Date(),
    }
    return next
  }
  return [
    ...prev,
    {
      stepNumber: data.stepNumber ?? prev.length,
      type: "tool",
      status: "completed",
      toolName: data.toolName,
      toolCallId: data.toolCallId ?? null,
      toolOutput: data.output ?? null,
      completedAt: new Date(),
    },
  ]
}
