"use client"

import { Button } from "@openbots/ui/components/button"
import { Spinner } from "@openbots/ui/components/spinner"
import { Textarea } from "@openbots/ui/components/textarea"
import { IconArrowUp, IconCornerDownRight, IconPlayerStop, IconX } from "@tabler/icons-react"
import * as React from "react"
import type { ReplyTarget } from "../types"

interface InputComposerProps {
  onSend: (prompt: string) => void
  isSubmitting?: boolean
  isActiveRun?: boolean
  onCancelRun?: () => void
  isCancelling?: boolean
  placeholder?: string
  disabled?: boolean
  replyTarget?: ReplyTarget | null
  onClearReply?: () => void
}

export function InputComposer({
  onSend,
  isSubmitting = false,
  isActiveRun = false,
  onCancelRun,
  isCancelling = false,
  placeholder = "Message your agent...",
  disabled = false,
  replyTarget,
  onClearReply,
}: InputComposerProps) {
  const [text, setText] = React.useState("")
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const isDisabled = disabled || isSubmitting
  const canSubmit = text.trim().length > 0 && !isDisabled && !isActiveRun

  // Auto-resize textarea
  React.useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 192)}px`
  }, [text])

  // Press "/" anywhere on the page to focus the composer
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/") return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.isComposing) return

      // Don't hijack "/" while the user is already typing somewhere
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return
      }

      const textarea = textareaRef.current
      if (!textarea || textarea.disabled) return

      event.preventDefault() // stops "/" from being typed into the textarea
      textarea.focus()
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  // Focus textarea when a reply is initiated
  React.useEffect(() => {
    if (replyTarget) {
      textareaRef.current?.focus()
    }
  }, [replyTarget])

  const handleSubmit = React.useCallback(() => {
    const rawText = text.trim()
    if (!rawText || !canSubmit) return

    let finalPrompt = rawText
    if (replyTarget) {
      const quoted = replyTarget.text
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n")
      finalPrompt = `${quoted}\n\n${rawText}`
    }

    onSend(finalPrompt)
    setText("")
    onClearReply?.()

    requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
  }, [text, canSubmit, replyTarget, onSend, onClearReply])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    } else if (event.key === "Escape" && replyTarget && !text) {
      event.preventDefault()
      onClearReply?.()
    }
  }

  const handleContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // Don't steal focus from interactive children (send / stop / clear buttons)
    if ((event.target as HTMLElement).closest("button")) return

    textareaRef.current?.focus()
  }

  return (
    <div className="w-full px-3 pb-4">
      <div className="mx-auto max-w-4xl">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit()
          }}
        >
          <div
            onClick={handleContainerClick}
            className="relative cursor-text overflow-hidden rounded-3xl border border-border bg-background transition focus-within:border-primary/40 focus-within:ring-3 focus-within:ring-border"
          >
            {replyTarget && (
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2 text-xs">
                <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <IconCornerDownRight className="size-3.5 shrink-0 text-primary" />
                  <span className="shrink-0 font-medium text-foreground">
                    Replying to {replyTarget.sender}
                  </span>
                  <span className="truncate text-muted-foreground/80">
                    "{replyTarget.text.replace(/\s+/g, " ").slice(0, 80)}"
                  </span>
                </div>
                {onClearReply && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      onClearReply()
                    }}
                    className="size-5 shrink-0 text-muted-foreground hover:text-foreground"
                    title="Cancel reply"
                    aria-label="Cancel reply"
                  >
                    <IconX className="size-3.5" />
                  </Button>
                )}
              </div>
            )}

            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={replyTarget ? `Reply to ${replyTarget.sender}...` : placeholder}
              disabled={disabled}
              rows={1}
              className="max-h-48 min-h-12 resize-none overflow-y-auto border-0 bg-transparent px-4 py-3.5 pr-14 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />

            <div className="absolute right-2 bottom-2">
              {isActiveRun && onCancelRun ? (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  onClick={onCancelRun}
                  disabled={isCancelling}
                  className="size-8 rounded-full"
                  aria-label="Stop run"
                >
                  {isCancelling ? (
                    <Spinner className="size-4" />
                  ) : (
                    <IconPlayerStop className="size-4" />
                  )}
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={!canSubmit}
                  className="size-8 rounded-full"
                  aria-label="Send message"
                >
                  {isSubmitting ? (
                    <Spinner className="size-4" />
                  ) : (
                    <IconArrowUp className="size-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
