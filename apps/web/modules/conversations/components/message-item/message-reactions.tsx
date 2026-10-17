"use client"

import { BubbleReactions } from "@openbots/ui/components/bubble"
import * as React from "react"
import { fireEmojiConfetti } from "./emoji-confetti"

interface MessageReactionsProps {
  reactions: string[]
  align: "start" | "end"
  isUser: boolean
  agentName: string
  onReact?: (emoji: string, origin?: { x: number; y: number }) => void
}

export function MessageReactions({
  reactions,
  align,
  isUser,
  agentName,
  onReact,
}: MessageReactionsProps) {
  if (reactions.length === 0) return null

  return (
    <BubbleReactions side="bottom" align={align}>
      {reactions.map((emoji, i) => (
        <button
          key={i}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            const rect = e.currentTarget.getBoundingClientRect()
            const origin = {
              x: (rect.left + rect.width / 2) / window.innerWidth,
              y: (rect.top + rect.height / 2) / window.innerHeight,
            }
            if (isUser) {
              fireEmojiConfetti(emoji, origin)
            } else {
              onReact?.(emoji, origin)
            }
          }}
          title={
            isUser
              ? `Reacted by ${agentName} (click for confetti)`
              : `Reacted ${emoji} (click to toggle)`
          }
          aria-label={`Reaction ${emoji}`}
          className="cursor-pointer px-1 py-px transition-transform hover:scale-125 active:scale-95"
        >
          {emoji}
        </button>
      ))}
    </BubbleReactions>
  )
}
