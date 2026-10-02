"use client"

import { Button } from "@openbots/ui/components/button"
import { Spinner } from "@openbots/ui/components/spinner"
import { Textarea } from "@openbots/ui/components/textarea"
import { IconArrowUp, IconPlayerStop } from "@tabler/icons-react"
import * as React from "react"

interface InputComposerProps {
  onSend: (prompt: string) => void
  isSubmitting?: boolean
  isActiveRun?: boolean
  onCancelRun?: () => void
  isCancelling?: boolean
  placeholder?: string
  disabled?: boolean
}

export function InputComposer({
  onSend,
  isSubmitting = false,
  isActiveRun = false,
  onCancelRun,
  isCancelling = false,
  placeholder = "Message your agent...",
  disabled = false,
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

  const handleSubmit = React.useCallback(() => {
    const prompt = text.trim()

    if (!prompt || !canSubmit) return

    onSend(prompt)
    setText("")

    requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
  }, [text, canSubmit, onSend])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }

  const handleContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // Don't steal focus from interactive children (send / stop buttons)
    if ((event.target as HTMLElement).closest("button")) return

    textareaRef.current?.focus()
  }

  return (
    <div className="w-full px-3 pb-4 sm:px-0">
      <div className="mx-auto max-w-4xl">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit()
          }}
        >
          <div
            onClick={handleContainerClick}
            className="relative cursor-text overflow-hidden rounded-3xl border border-border bg-sidebar transition focus-within:border-ring focus-within:ring-3 focus-within:ring-border"
          >
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
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
