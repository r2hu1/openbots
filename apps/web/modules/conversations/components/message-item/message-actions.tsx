"use client"

import { Button } from "@openbots/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openbots/ui/components/dropdown-menu"
import { MessageFooter } from "@openbots/ui/components/message"
import * as React from "react"
import {
  Check as IconCheck,
  Copy as IconCopy,
  Share as IconShare,
  SmileCircle,
} from "reicon-react"
import { formatMsgTime } from "../../utils"
import { QUICK_REACTIONS } from "./emoji-confetti"

interface MessageActionsProps {
  isUser: boolean
  createdAt?: string | Date | null
  onCopy: () => void
  onShare: () => void
  copied: boolean
  shared: boolean
  onReact?: (emoji: string, origin?: { x: number; y: number }) => void
}

export function MessageActions({
  isUser,
  createdAt,
  onCopy,
  onShare,
  copied,
  shared,
  onReact,
}: MessageActionsProps) {
  return (
    <MessageFooter className="items-center gap-2 px-0">
      {isUser ? (
        <div className="flex items-center gap-0.5 opacity-80 transition-opacity focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-hover/message:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onCopy}
            className="size-6 text-muted-foreground hover:text-foreground"
            title={copied ? "Copied!" : "Copy message"}
            aria-label={copied ? "Copied!" : "Copy message"}
          >
            {copied ? (
              <IconCheck className="size-3" />
            ) : (
              <IconCopy className="size-3" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onShare}
            className="size-6 text-muted-foreground hover:text-foreground"
            title={shared ? "Shared!" : "Share message"}
            aria-label={shared ? "Shared!" : "Share message"}
          >
            {shared ? (
              <IconCheck className="size-3" />
            ) : (
              <IconShare className="size-3" />
            )}
          </Button>
          <span className="ml-1 text-[10px] text-muted-foreground">
            {createdAt ? formatMsgTime(createdAt) : ""}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-0.5 opacity-80 transition-opacity focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-hover/message:opacity-100">
          <span className="mr-1 text-[10px] text-muted-foreground">
            {createdAt ? formatMsgTime(createdAt) : ""}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger
              openOnHover
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-6 text-muted-foreground hover:text-foreground"
                  title="Add reaction"
                  aria-label="Add reaction"
                >
                  <SmileCircle className="size-3" />
                </Button>
              }
            />
            <DropdownMenuContent
              align="start"
              side="top"
              className="no-scrollbar flex w-full"
            >
              {QUICK_REACTIONS.map((emoji) => (
                <DropdownMenuItem
                  key={emoji}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    onReact?.(emoji, {
                      x: (rect.left + rect.width / 2) / window.innerWidth,
                      y: (rect.top + rect.height / 2) / window.innerHeight,
                    })
                  }}
                  className="cursor-pointer text-base transition-transform"
                >
                  {emoji}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onCopy}
            className="size-6 text-muted-foreground hover:text-foreground"
            title={copied ? "Copied!" : "Copy message"}
            aria-label={copied ? "Copied!" : "Copy message"}
          >
            {copied ? (
              <IconCheck className="size-3" />
            ) : (
              <IconCopy className="size-3" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onShare}
            className="size-6 text-muted-foreground hover:text-foreground"
            title={shared ? "Shared!" : "Share message"}
            aria-label={shared ? "Shared!" : "Share message"}
          >
            {shared ? (
              <IconCheck className="size-3" />
            ) : (
              <IconShare className="size-3" />
            )}
          </Button>
        </div>
      )}
    </MessageFooter>
  )
}
