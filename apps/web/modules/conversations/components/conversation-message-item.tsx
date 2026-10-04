"use client"

import {
  Bubble,
  BubbleContent,
  BubbleReactions,
} from "@openbots/ui/components/bubble"
import { Button } from "@openbots/ui/components/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@openbots/ui/components/context-menu"
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageGroup,
} from "@openbots/ui/components/message"
import { Blobatar } from "@openbots/ui/components/ui/blobatar"
import {
  Check as IconCheck,
  Copy as IconCopy,
  Download as IconDownload,
  CodeFile as IconFileCode,
  FilePdf as IconFileTypePdf,
  FileText as IconFileTypeTxt,
  Reply as IconMessageReply,
  Share as IconShare,
} from "reicon-react"
import confetti from "canvas-confetti"
import * as React from "react"
import { Markdown } from "@/components/shared/markdown"
import { ArtifactCard } from "@/modules/artifacts/artifact-card"
import { type ParsedArtifact, parseArtifacts } from "@/modules/artifacts/parser"
import type { MessageItem, ReplyTarget } from "../types"
import { formatMsgTime, getMessageText, splitIntoMessageParts } from "../utils"

function fireEmojiConfetti(emoji: string, origin?: { x: number; y: number }) {
  try {
    const shape = confetti.shapeFromText({ text: emoji, scalar: 2.2 })
    confetti({
      shapes: [shape],
      scalar: 2.2,
      particleCount: 24,
      spread: 60,
      startVelocity: 25,
      decay: 0.9,
      origin: origin ?? { x: 0.85, y: 0.7 },
      ticks: 150,
      disableForReducedMotion: true,
    })
  } catch (err) {
    console.warn("Failed to trigger emoji confetti:", err)
  }
}

interface ConversationMessageItemProps {
  message: MessageItem
  agentName: string
  onOpenArtifact?: (artifact: ParsedArtifact) => void
  onReply?: (target: ReplyTarget) => void
  isStreaming?: boolean
}

export function ConversationMessageItem({
  message,
  agentName,
  onOpenArtifact,
  onReply,
  isStreaming = false,
}: ConversationMessageItemProps) {
  const isUser = message.role === "user"
  const text = getMessageText(message.content)

  const reactions = React.useMemo(() => {
    const meta = (message.metadata as Record<string, any>) || {}
    if (Array.isArray(meta.reactions)) {
      return meta.reactions as string[]
    }
    return []
  }, [message.metadata])

  // Track previously seen reactions for this message to fire confetti once when a new reaction appears
  const prevReactionsRef = React.useRef<string[]>(reactions)
  React.useEffect(() => {
    const prev = prevReactionsRef.current
    if (reactions.length > prev.length) {
      const newlyAdded = reactions.filter((r) => !prev.includes(r))
      for (const emoji of newlyAdded) {
        fireEmojiConfetti(emoji)
      }
    }
    prevReactionsRef.current = reactions
  }, [reactions])

  const { messageParts } = React.useMemo(() => {
    if (isUser) {
      return {
        messageParts: [
          {
            partId: `usr-${message.id}`,
            segments: [
              { id: `usr-${message.id}`, type: "text" as const, text },
            ],
          },
        ],
      }
    }

    // Split text into natural conversational parts when text is large
    const parts = splitIntoMessageParts(text)
    const formattedParts = parts.map((partText, idx) => {
      const { segments } = parseArtifacts(partText)
      return {
        partId: `asst-${message.id}-p${idx}`,
        segments,
      }
    })

    return { messageParts: formattedParts }
  }, [isUser, message.id, text])

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

  const bubbleRef = React.useRef<HTMLDivElement>(null)
  const [selectedText, setSelectedText] = React.useState<string | null>(null)
  const [selectionPosition, setSelectionPosition] = React.useState<{
    top: number
    left: number
  } | null>(null)

  // Track text selection inside this message's text bubbles (ignoring artifacts)
  const handleMouseUp = React.useCallback(() => {
    // Wait a tick for window.getSelection to update
    requestAnimationFrame(() => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || !bubbleRef.current) {
        setSelectedText(null)
        setSelectionPosition(null)
        return
      }

      const raw = selection.toString().trim()
      if (!raw) {
        setSelectedText(null)
        setSelectionPosition(null)
        return
      }

      // Check if the selection is inside our text content
      const anchorNode = selection.anchorNode
      const focusNode = selection.focusNode
      if (!anchorNode || !focusNode) return

      const isInside =
        bubbleRef.current.contains(anchorNode) &&
        bubbleRef.current.contains(focusNode)

      if (!isInside) {
        setSelectedText(null)
        setSelectionPosition(null)
        return
      }

      // Make sure the selection is NOT inside an artifact card
      const anchorElement =
        anchorNode instanceof Element ? anchorNode : anchorNode.parentElement
      const focusElement =
        focusNode instanceof Element ? focusNode : focusNode.parentElement

      if (
        anchorElement?.closest("[data-artifact-card]") ||
        focusElement?.closest("[data-artifact-card]")
      ) {
        setSelectedText(null)
        setSelectionPosition(null)
        return
      }

      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const bubbleRect = bubbleRef.current.getBoundingClientRect()

      setSelectedText(raw)
      setSelectionPosition({
        top: rect.top - bubbleRect.top - 36, // position 36px above selection
        left: rect.left - bubbleRect.left + rect.width / 2,
      })
    })
  }, [])

  // Clear floating menu on click away or selection change
  React.useEffect(() => {
    const handleDocumentSelectionChange = () => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) {
        setSelectedText(null)
        setSelectionPosition(null)
      }
    }

    document.addEventListener("selectionchange", handleDocumentSelectionChange)
    return () => {
      document.removeEventListener(
        "selectionchange",
        handleDocumentSelectionChange
      )
    }
  }, [])

  const handleReplySelected = React.useCallback(
    (replyText?: string) => {
      const targetText = replyText || selectedText || text
      if (!targetText) return

      const sender = isUser ? "You" : agentName
      if (onReply) {
        onReply({
          id: message.id,
          sender,
          text: targetText,
        })
      } else {
        const textarea = document.querySelector(
          "textarea"
        ) as HTMLTextAreaElement | null
        if (textarea) {
          const quoted = targetText
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n")
          const current = textarea.value
          const separator = current
            ? current.endsWith("\n\n")
              ? ""
              : current.endsWith("\n")
                ? "\n"
                : "\n\n"
            : ""
          textarea.value = `${current}${separator}${quoted}\n\n`
          textarea.dispatchEvent(new Event("input", { bubbles: true }))
          textarea.focus()
        }
      }

      // Clear selection
      window.getSelection()?.removeAllRanges()
      setSelectedText(null)
      setSelectionPosition(null)
    },
    [selectedText, text, isUser, agentName, message.id, onReply]
  )

  const handleReply = React.useCallback(() => {
    // If text was selected prior to opening the context menu, reply to that selection
    if (selectedText) {
      handleReplySelected(selectedText)
      return
    }

    const currentSelection = window.getSelection()?.toString().trim()
    if (currentSelection) {
      handleReplySelected(currentSelection)
      return
    }

    handleReplySelected(text)
  }, [selectedText, text, handleReplySelected])

  const handleDownload = React.useCallback(
    (format: "txt" | "md" | "json") => {
      if (!text) return

      let content = text
      let mimeType = "text/plain"
      let extension = format

      if (format === "json") {
        content = JSON.stringify(
          {
            id: message.id,
            role: message.role,
            author: isUser ? "User" : agentName,
            createdAt: message.createdAt,
            content: text,
          },
          null,
          2
        )
        mimeType = "application/json"
      } else if (format === "md") {
        mimeType = "text/markdown"
      }

      const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `message-${message.id}.${extension}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },
    [text, message.id, message.role, message.createdAt, isUser, agentName]
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger className="block w-full">
        <MessageGroup className="group">
          <Message align={isUser ? "end" : "start"} className="gap-2">
            <MessageContent>
              <div
                ref={bubbleRef}
                onMouseUp={handleMouseUp}
                className="relative flex w-full flex-col gap-2"
              >
                {selectionPosition && selectedText && (
                  <div
                    style={{
                      top: `${selectionPosition.top}px`,
                      left: `${selectionPosition.left}px`,
                      transform: "translateX(-50%)",
                    }}
                    className="absolute z-30 animate-in duration-150 fade-in-0 zoom-in-95"
                  >
                    <Button
                      type="button"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleReplySelected()
                      }}
                      className="h-7 gap-1.5 rounded-full px-2.5 text-xs"
                    >
                      <IconMessageReply className="size-3.5" />
                      <span>Reply</span>
                    </Button>
                  </div>
                )}

                {isUser ? (
                  <Bubble variant="default" align="end" className="relative">
                    <BubbleContent className="p-1.5 px-2.5 text-sm whitespace-pre-wrap text-foreground">
                      {text}
                    </BubbleContent>
                    {reactions.length > 0 && (
                      <BubbleReactions
                        side="bottom"
                        align="end"
                        className="border-none! bg-secondary ring-0! outline-none!"
                      >
                        {reactions.map((emoji, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              const rect =
                                e.currentTarget.getBoundingClientRect()
                              fireEmojiConfetti(emoji, {
                                x:
                                  (rect.left + rect.width / 2) /
                                  window.innerWidth,
                                y:
                                  (rect.top + rect.height / 2) /
                                  window.innerHeight,
                              })
                            }}
                            title={`Reacted by ${agentName} (click for confetti)`}
                            aria-label={`Reaction ${emoji}`}
                            className="cursor-pointer px-1 py-px transition-transform hover:scale-125 active:scale-95"
                          >
                            {emoji}
                          </button>
                        ))}
                      </BubbleReactions>
                    )}
                  </Bubble>
                ) : (
                  messageParts.map((part, partIndex) => {
                    const isLastPart = partIndex === messageParts.length - 1
                    return (
                      <React.Fragment key={part.partId}>
                        {part.segments.map((seg, segIndex) => {
                          if (seg.type === "artifact" && seg.artifact) {
                            const artifact = seg.artifact
                            return (
                              <div key={seg.id} className="w-full max-w-2xl">
                                <ArtifactCard
                                  artifact={artifact}
                                  onClick={() => onOpenArtifact?.(artifact)}
                                />
                              </div>
                            )
                          }
                          if (seg.text) {
                            const isVeryLastSegment =
                              isLastPart &&
                              segIndex === part.segments.length - 1
                            return (
                              <Bubble
                                key={seg.id}
                                variant="secondary"
                                align="start"
                              >
                                <BubbleContent className="typeset typeset-chat text-sm text-sidebar-foreground">
                                  <Markdown>{seg.text}</Markdown>
                                  {isStreaming && isVeryLastSegment && (
                                    <span
                                      className="ml-1 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse rounded-xs bg-foreground"
                                      aria-hidden="true"
                                    />
                                  )}
                                </BubbleContent>
                              </Bubble>
                            )
                          }
                          return null
                        })}
                      </React.Fragment>
                    )
                  })
                )}
              </div>

              <MessageFooter
                className={
                  isUser
                    ? "-mt-1 items-center gap-1.5 px-0"
                    : "items-center gap-2 px-0"
                }
              >
                {isUser ? (
                  <>
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
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
                      <span className="text-[10px] text-muted-foreground">
                        {formatMsgTime(message.createdAt)}
                      </span>
                    </div>
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

                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleCopy}>
          <IconCopy />
          <span>Copy</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleReply}>
          <IconMessageReply />
          <span>{selectedText ? "Reply to selection" : "Reply"}</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleShare}>
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
            <ContextMenuItem onClick={() => handleDownload("txt")}>
              <IconFileTypeTxt />
              <span>Plain Text (.txt)</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleDownload("md")}>
              <IconFileCode />
              <span>Markdown (.md)</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleDownload("json")}>
              <IconFileCode />
              <span>JSON (.json)</span>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  )
}
