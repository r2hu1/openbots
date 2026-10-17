"use client"

import * as React from "react"
import { fireEmojiConfetti } from "./emoji-confetti"

const seenReactionsByMsg = new Map<string, Set<string>>()

export function useMessageReactions({
  messageId,
  isUser,
  text,
  metadata,
  onReact,
  bubbleRef,
}: {
  messageId: string
  isUser: boolean
  text: string
  metadata: unknown
  onReact?: (messageId: string, emoji: string) => void
  bubbleRef: React.RefObject<HTMLDivElement | null>
}) {
  const msgTrackingKey = React.useMemo(() => {
    return isUser && text ? `user-${text.trim()}` : `msg-${messageId}`
  }, [isUser, text, messageId])

  const userFiredReactionsRef = React.useRef<Set<string>>(new Set())

  const handleReaction = React.useCallback(
    (emoji: string, origin?: { x: number; y: number }) => {
      if (isUser) return
      userFiredReactionsRef.current.add(emoji)
      fireEmojiConfetti(emoji, origin)
      onReact?.(messageId, emoji)
    },
    [isUser, messageId, onReact]
  )

  const reactions = React.useMemo(() => {
    const meta = (metadata as Record<string, any>) || {}
    return Array.isArray(meta.reactions) ? (meta.reactions as string[]) : []
  }, [metadata])

  React.useEffect(() => {
    let seenSet = seenReactionsByMsg.get(msgTrackingKey)
    if (!seenSet) {
      seenSet = new Set(reactions)
      seenReactionsByMsg.set(msgTrackingKey, seenSet)
      return
    }

    for (const emoji of reactions) {
      if (!seenSet.has(emoji)) {
        seenSet.add(emoji)
        if (userFiredReactionsRef.current.has(emoji)) {
          userFiredReactionsRef.current.delete(emoji)
        } else {
          const rect = bubbleRef.current?.getBoundingClientRect()
          const origin = rect
            ? {
                x: (isUser ? rect.right - 40 : rect.left + 40) / window.innerWidth,
                y: (rect.bottom - 10) / window.innerHeight,
              }
            : isUser
              ? { x: 0.85, y: 0.7 }
              : { x: 0.2, y: 0.7 }
          fireEmojiConfetti(emoji, origin)
        }
      }
    }
  }, [reactions, msgTrackingKey, isUser, bubbleRef])

  return { reactions, handleReaction }
}
