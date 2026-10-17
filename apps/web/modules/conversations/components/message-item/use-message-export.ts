"use client"

import * as React from "react"

interface UseMessageExportProps {
  messageId: string
  role: string
  createdAt?: string | Date | null
  text: string
  isUser: boolean
  agentName: string
}

export function useMessageExport({
  messageId,
  role,
  createdAt,
  text,
  isUser,
  agentName,
}: UseMessageExportProps) {
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

  const handleDownload = React.useCallback(
    (format: "txt" | "md" | "json") => {
      if (!text) return
      let content = text
      let mimeType = "text/plain"
      if (format === "json") {
        content = JSON.stringify(
          { id: messageId, role, author: isUser ? "User" : agentName, createdAt, content: text },
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
      a.download = `message-${messageId}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },
    [text, messageId, role, createdAt, isUser, agentName]
  )

  return { copied, shared, handleCopy, handleShare, handleDownload }
}
