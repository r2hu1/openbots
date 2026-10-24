import type { StepItem } from "../types"
import { truncateText } from "./label-utils"

export function resolveMemoryAndChatLabels(
  normalized: string,
  status: StepItem["status"] | undefined,
  inputObj: Record<string, unknown> | null
): { label: string; detail?: string } | null {
  const isRunning = status === "running"
  const isFailed = status === "failed"

  if (normalized === "search_memory") {
    const q = typeof inputObj?.query === "string" ? inputObj.query : null
    if (isRunning) {
      return {
        label: q ? `Searching memories for "${truncateText(q, 30)}"...` : "Searching memory...",
        detail: q ?? undefined,
      }
    }
    if (isFailed) return { label: "Memory search failed" }
    return {
      label: q ? `Searched memory for "${truncateText(q, 30)}"` : "Searched memory",
      detail: q ?? undefined,
    }
  }

  if (normalized === "save_memory") {
    const k = typeof inputObj?.key === "string" ? inputObj.key : null
    if (isRunning) return { label: k ? `Saving memory '${truncateText(k, 25)}'...` : "Saving memory..." }
    if (isFailed) return { label: "Failed to save memory" }
    return { label: k ? `Saved memory '${truncateText(k, 25)}'` : "Saved memory" }
  }

  if (normalized === "delete_memory") {
    const k = typeof inputObj?.keyOrId === "string" ? inputObj.keyOrId : null
    if (isRunning) return { label: k ? `Deleting memory '${truncateText(k, 25)}'...` : "Deleting memory..." }
    if (isFailed) return { label: "Failed to delete memory" }
    return { label: k ? `Deleted memory '${truncateText(k, 25)}'` : "Deleted memory" }
  }

  if (normalized === "get_chat_history") {
    const q = typeof inputObj?.query === "string" ? inputObj.query : null
    if (isRunning) {
      return {
        label: q ? `Looking up chat history for "${truncateText(q, 28)}"...` : "Reading chat history...",
        detail: q ?? undefined,
      }
    }
    if (isFailed) return { label: "Failed to retrieve chat history" }
    return {
      label: q ? `Retrieved chat history for "${truncateText(q, 28)}"` : "Retrieved chat history",
      detail: q ?? undefined,
    }
  }

  return null
}
