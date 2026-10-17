"use client"

import { MessageScrollerItem } from "@openbots/ui/components/message-scroller"
import * as React from "react"
import type { ParsedArtifact } from "@/modules/artifacts/parser"
import { ConversationMessageItem } from "./conversation-message-item"

interface StreamingAssistantMessageProps {
  activeRunId?: string
  conversationId?: string | null
  streamingText: string
  agentName: string
  onOpenArtifact?: (artifact: ParsedArtifact) => void
}

/**
 * Extracted streaming assistant message to stabilise the `createdAt` ref and
 * prevent the entire timeline from re-rendering on every text-delta frame.
 */
export const StreamingAssistantMessage = React.memo(
  function StreamingAssistantMessage({
    activeRunId,
    conversationId,
    streamingText,
    agentName,
    onOpenArtifact,
  }: StreamingAssistantMessageProps) {
    // Pin the createdAt so it doesn't change on every delta
    const createdAtRef = React.useRef(new Date())

    const msgId = `run-asst-${activeRunId || "current"}`

    const message = React.useMemo(
      () => ({
        id: msgId,
        conversationId: conversationId || "current",
        role: "assistant" as const,
        content: { text: streamingText },
        createdAt: createdAtRef.current,
      }),
      [msgId, conversationId, streamingText]
    )

    return (
      <MessageScrollerItem
        key={msgId}
        id={msgId}
        data-message-id={msgId}
        messageId={msgId}
      >
        <ConversationMessageItem
          message={message}
          agentName={agentName}
          isStreaming={true}
          onOpenArtifact={onOpenArtifact}
        />
      </MessageScrollerItem>
    )
  }
)
