"use client"

import { Bubble, BubbleContent } from "@openbots/ui/components/bubble"
import { Button } from "@openbots/ui/components/button"
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageGroup,
} from "@openbots/ui/components/message"
import { Blobatar } from "@openbots/ui/components/ui/blobatar"
import { IconCheck, IconCopy, IconShare } from "@tabler/icons-react"
import * as React from "react"
import { Markdown } from "@/components/shared/markdown"
import type { MessageItem } from "../types"
import { formatMsgTime, getMessageText } from "../utils"

interface ConversationMessageItemProps {
  message: MessageItem
  agentName: string
}

export function ConversationMessageItem({
  message,
  agentName,
}: ConversationMessageItemProps) {
  const isUser = message.role === "user"
  const text = getMessageText(message.content)

  const [copied, setCopied] = React.useState(false)
  const [shared, setShared] = React.useState(false)

  const handleCopy = React.useCallback(async () => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy message:", err)
    }
  }, [text])

  const handleShare = React.useCallback(async () => {
    if (!text) return
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: `Message from ${isUser ? "User" : agentName}`,
          text,
        })
      } else {
        await navigator.clipboard.writeText(text)
      }
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        console.error("Failed to share message:", err)
      }
    }
  }, [text, isUser, agentName])

  return (
    <MessageGroup className="group">
      <Message align={isUser ? "end" : "start"} className="gap-2">
        <MessageContent>
          <Bubble
            variant={isUser ? "default" : "outline"}
            align={isUser ? "end" : "start"}
          >
            <BubbleContent
              className={
                isUser
                  ? "p-1.5 px-2.5 text-sm whitespace-pre-wrap text-foreground"
                  : "typeset typeset-chat p-1.5 px-2.5 text-sm text-foreground"
              }
            >
              {isUser ? text : <Markdown>{text}</Markdown>}
            </BubbleContent>
          </Bubble>

          <MessageFooter
            className={
              isUser ? "items-center gap-1.5 px-0" : "items-center gap-2 px-0"
            }
          >
            {isUser ? (
              <>
                <div className="flex items-center gap-0.5 transition-opacity group-hover:opacity-100 md:opacity-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleCopy}
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
                    onClick={handleShare}
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
                <span className="text-xs font-medium text-foreground">You</span>
                <span className="text-[10px] text-muted-foreground">
                  {formatMsgTime(message.createdAt)}
                </span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1">
                  <Blobatar name={agentName} className="size-6 shrink-0" />
                  <span className="text-xs font-medium text-foreground">
                    {agentName}
                  </span>
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    {formatMsgTime(message.createdAt)}
                  </span>
                </div>

                <div className="flex items-center gap-0.5 transition-opacity group-hover:opacity-100 md:opacity-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleCopy}
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
                    onClick={handleShare}
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
              </>
            )}
          </MessageFooter>
        </MessageContent>
      </Message>
    </MessageGroup>
  )
}
