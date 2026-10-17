"use client"

import { Button } from "@openbots/ui/components/button"
import * as React from "react"
import { Reply as IconMessageReply } from "reicon-react"

interface MessageSelectionToolbarProps {
  position: { top: number; left: number } | null
  selectedText: string | null
  onReply: () => void
}

export function MessageSelectionToolbar({
  position,
  selectedText,
  onReply,
}: MessageSelectionToolbarProps) {
  if (!position || !selectedText) return null

  return (
    <div
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: "translateX(-50%)",
      }}
      className="absolute z-30 animate-in duration-150 fade-in-0 zoom-in-95"
    >
      <Button
        type="button"
        size="xs"
        onClick={(e) => {
          e.stopPropagation()
          onReply()
        }}
        className="h-7 gap-1.5 rounded-full px-2.5 text-xs"
      >
        <IconMessageReply className="size-3.5" />
        <span>Reply</span>
      </Button>
    </div>
  )
}
