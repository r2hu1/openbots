"use client"

import * as React from "react"
import type { ReplyTarget } from "../../types"

interface UseMessageSelectionProps {
  text: string
  isUser: boolean
  agentName: string
  messageId: string
  onReply?: (target: ReplyTarget) => void
  bubbleRef: React.RefObject<HTMLDivElement | null>
}

export function useMessageSelection({
  text,
  isUser,
  agentName,
  messageId,
  onReply,
  bubbleRef,
}: UseMessageSelectionProps) {
  const [selectedText, setSelectedText] = React.useState<string | null>(null)
  const [selectionPosition, setSelectionPosition] = React.useState<{
    top: number
    left: number
  } | null>(null)

  const handleMouseUp = React.useCallback(() => {
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
        top: rect.top - bubbleRect.top - 36,
        left: rect.left - bubbleRect.left + rect.width / 2,
      })
    })
  }, [bubbleRef])

  React.useEffect(() => {
    const handleDocSelection = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) {
        setSelectedText(null)
        setSelectionPosition(null)
      }
    }
    document.addEventListener("selectionchange", handleDocSelection)
    return () => document.removeEventListener("selectionchange", handleDocSelection)
  }, [])

  const handleReplySelected = React.useCallback(
    (replyText?: string) => {
      const targetText = replyText || selectedText || text
      if (!targetText) return

      const sender = isUser ? "You" : agentName
      if (onReply) {
        onReply({ id: messageId, sender, text: targetText })
      } else {
        const textarea = document.querySelector("textarea") as HTMLTextAreaElement | null
        if (textarea) {
          const quoted = targetText.split("\n").map((line) => `> ${line}`).join("\n")
          const current = textarea.value
          const sep = current ? (current.endsWith("\n\n") ? "" : current.endsWith("\n") ? "\n" : "\n\n") : ""
          textarea.value = `${current}${sep}${quoted}\n\n`
          textarea.dispatchEvent(new Event("input", { bubbles: true }))
          textarea.focus()
        }
      }

      window.getSelection()?.removeAllRanges()
      setSelectedText(null)
      setSelectionPosition(null)
    },
    [selectedText, text, isUser, agentName, messageId, onReply]
  )

  const handleReply = React.useCallback(() => {
    const cur = window.getSelection()?.toString().trim()
    handleReplySelected(selectedText || cur || text)
  }, [selectedText, text, handleReplySelected])

  return {
    selectedText,
    selectionPosition,
    handleMouseUp,
    handleReplySelected,
    handleReply,
  }
}
