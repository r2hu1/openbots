"use client"

import * as React from "react"
import type { MessageItem } from "@/modules/conversations/types"
import type { RunRecord } from "@/modules/runs/types"

interface UseReconciledMessagesOptions {
  serverMessages: MessageItem[]
  optimisticMessages: MessageItem[]
  activeRun: RunRecord | null
  activeConversationId: string | null
  onClearOptimistic: () => void
}

export function useReconciledMessages({
  serverMessages,
  optimisticMessages,
  activeRun,
  activeConversationId,
  onClearOptimistic,
}: UseReconciledMessagesOptions) {
  const messages = React.useMemo(() => {
    const result: MessageItem[] = [...serverMessages]

    // If an active run has just completed and serverMessages hasn't updated yet, show output
    if (activeRun && activeRun.status === "completed") {
      const output = activeRun.output
      const completedOutputText =
        output &&
        typeof output === "object" &&
        "text" in output &&
        typeof (output as { text: unknown }).text === "string"
          ? (output as { text: string }).text.trim()
          : null

      if (completedOutputText) {
        const hasResponseAlready = result.some((m) => {
          if (m.role !== "assistant") return false
          const t =
            typeof m.content === "object" && m.content && "text" in m.content
              ? (m.content as { text: string }).text
              : String(m.content)
          return t.trim() === completedOutputText
        })

        if (!hasResponseAlready) {
          result.push({
            id: `opt-assistant-${activeRun.id}`,
            conversationId: activeConversationId || "temp",
            role: "assistant",
            content: { text: completedOutputText },
            createdAt: activeRun.completedAt || new Date(),
          })
        }
      }
    }

    // Append optimistic user messages that are not yet in serverMessages
    if (optimisticMessages.length > 0) {
      for (const opt of optimisticMessages) {
        if (opt.role !== "user") continue
        const optText =
          typeof opt.content === "object" &&
          opt.content &&
          "text" in opt.content
            ? (opt.content as { text: string }).text
            : String(opt.content)

        const existsInServer = result.some((srv) => {
          if (srv.role !== "user") return false
          const srvText =
            typeof srv.content === "object" &&
            srv.content &&
            "text" in srv.content
              ? (srv.content as { text: string }).text
              : String(srv.content)
          return srvText.trim() === optText.trim()
        })

        if (!existsInServer) {
          result.push(opt)
        }
      }
    }

    // Final safety: deduplicate by id
    const seenIds = new Set<string>()
    return result.filter((m) => {
      if (seenIds.has(m.id)) return false
      seenIds.add(m.id)
      return true
    })
  }, [serverMessages, optimisticMessages, activeRun, activeConversationId])

  // Clear optimistic messages once server messages catch up or run finishes
  React.useEffect(() => {
    if (optimisticMessages.length === 0) return

    if (
      activeRun &&
      (activeRun.status === "completed" || activeRun.status === "failed")
    ) {
      onClearOptimistic()
      return
    }

    if (serverMessages.length > 0) {
      const allUserMessagesSaved = optimisticMessages.every((opt) => {
        if (opt.role !== "user") return true
        const optText =
          typeof opt.content === "object" &&
          opt.content &&
          "text" in opt.content
            ? (opt.content as { text: string }).text
            : String(opt.content)

        return serverMessages.some((srv) => {
          if (srv.role !== "user") return false
          const srvText =
            typeof srv.content === "object" &&
            srv.content &&
            "text" in srv.content
              ? (srv.content as { text: string }).text
              : String(srv.content)
          return srvText.trim() === optText.trim()
        })
      })

      if (allUserMessagesSaved) {
        onClearOptimistic()
      }
    }
  }, [serverMessages, optimisticMessages, activeRun, onClearOptimistic])

  return messages
}
