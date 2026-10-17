"use client"

import { Button } from "@openbots/ui/components/button"
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@openbots/ui/components/context-menu"
import * as React from "react"
import {
  Copy as IconCopy,
  Download as IconDownload,
  CodeFile as IconFileCode,
  FilePdf as IconFileTypePdf,
  FileText as IconFileTypeTxt,
  Reply as IconMessageReply,
  Share as IconShare,
} from "reicon-react"
import { QUICK_REACTIONS } from "./emoji-confetti"

interface MessageContextMenuContentProps {
  isUser: boolean
  selectedText: string | null
  onCopy: () => void
  onReply: () => void
  onShare: () => void
  onDownload: (format: "txt" | "md" | "json") => void
  onReact?: (emoji: string, origin?: { x: number; y: number }) => void
  onClose?: () => void
}

export function MessageContextMenuContent({
  isUser,
  selectedText,
  onCopy,
  onReply,
  onShare,
  onDownload,
  onReact,
  onClose,
}: MessageContextMenuContentProps) {
  return (
    <ContextMenuContent className="relative w-48 overflow-visible">
      {!isUser && (
        <div className="absolute -top-10 left-0 z-50">
          <div className="flex min-w-0 flex-row items-center gap-0 rounded-md border bg-popover/90 p-px backdrop-blur-2xl">
            {QUICK_REACTIONS.map((emoji) => (
              <Button
                variant="ghost"
                size="icon-sm"
                key={emoji}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  onClose?.()
                  onReact?.(emoji, {
                    x: (rect.left + rect.width / 2) / window.innerWidth,
                    y: (rect.top + rect.height / 2) / window.innerHeight,
                  })
                }}
                className="hover:scale hover:bg-popover-foreground/15!"
              >
                {emoji}
              </Button>
            ))}
          </div>
        </div>
      )}

      <ContextMenuItem onClick={onCopy}>
        <IconCopy />
        <span>Copy</span>
      </ContextMenuItem>
      <ContextMenuItem onClick={onReply}>
        <IconMessageReply />
        <span>{selectedText ? "Reply to selection" : "Reply"}</span>
      </ContextMenuItem>
      <ContextMenuItem onClick={onShare}>
        <IconShare />
        <span>Share</span>
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <IconDownload className="mr-2" />
          <span>Download</span>
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-40">
          <ContextMenuItem onClick={() => onDownload("txt")}>
            <IconFileTypeTxt />
            <span>Plain Text (.txt)</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDownload("md")}>
            <IconFileCode />
            <span>Markdown (.md)</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDownload("json")}>
            <IconFileCode />
            <span>JSON (.json)</span>
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
    </ContextMenuContent>
  )
}
