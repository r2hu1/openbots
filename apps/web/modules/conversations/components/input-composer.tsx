"use client"

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@openbots/ui/components/attachment"
import { Button } from "@openbots/ui/components/button"
import { Spinner } from "@openbots/ui/components/spinner"
import { Textarea } from "@openbots/ui/components/textarea"
import { toast } from "@openbots/ui/components/toast"
import * as React from "react"
import {
  ArrowToDownLeft,
  ArrowUp,
  ImageUp,
  Paperclip,
  Plus,
  Stop3,
  X,
} from "reicon-react"
import {
  useDeleteConversationImageMutation,
  useUploadConversationImageMutation,
} from "../queries"
import type { ReplyTarget } from "../types"

const MAX_IMAGES = 10
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

interface UploadingImage {
  id: string
  file: File
  previewUrl: string
  uploadedUrl?: string
  uploadedPath?: string
  status: "uploading" | "done" | "error"
  errorMessage?: string
}

interface InputComposerProps {
  onSend: (prompt: string, images?: string[]) => void
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
  const [attachments, setAttachments] = React.useState<UploadingImage[]>([])
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const uploadMutation = useUploadConversationImageMutation()
  const deleteMutation = useDeleteConversationImageMutation()

  const isUploadingAny = attachments.some((att) => att.status === "uploading")
  const hasValidImages = attachments.some((att) => att.status === "done")
  const isDisabled = disabled || isSubmitting
  const canSubmit =
    (text.trim().length > 0 || hasValidImages) &&
    !isDisabled &&
    !isActiveRun &&
    !isUploadingAny

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

      event.preventDefault()
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

  const handleProcessFiles = React.useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter((f) => f.type.startsWith("image/"))

      if (imageFiles.length === 0) {
        toast.add({
          title: "Invalid file type",
          description:
            "Please upload image files only (PNG, JPG, WebP, GIF, SVG).",
          type: "warning",
        })
        return
      }

      const remainingSlots = MAX_IMAGES - attachments.length
      if (remainingSlots <= 0) {
        toast.add({
          title: "Limit reached",
          description: `You can attach at most ${MAX_IMAGES} images at a time.`,
          type: "warning",
        })
        return
      }

      const filesToProcess = imageFiles.slice(0, remainingSlots)
      if (imageFiles.length > remainingSlots) {
        toast.add({
          title: "Too many files",
          description: `Only the first ${remainingSlots} images were added (${MAX_IMAGES} max).`,
          type: "warning",
        })
      }

      for (const file of filesToProcess) {
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          toast.add({
            title: "File too large",
            description: `"${file.name}" exceeds the 5MB size limit.`,
            type: "error",
          })
          continue
        }

        const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        const previewUrl = URL.createObjectURL(file)

        const newAttachment: UploadingImage = {
          id,
          file,
          previewUrl,
          status: "uploading",
        }

        setAttachments((prev) => [...prev, newAttachment])

        // Start upload
        uploadMutation
          .mutateAsync(file)
          .then((res) => {
            setAttachments((prev) =>
              prev.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      status: "done",
                      uploadedUrl: res.url,
                      uploadedPath: res.path,
                    }
                  : item
              )
            )
          })
          .catch((err) => {
            console.error("Upload error:", err)
            const errorMsg =
              err?.message || "Failed to upload image. Please try again."
            toast.add({
              title: "Upload failed",
              description: `Could not upload "${file.name}": ${errorMsg}`,
              type: "error",
            })
            setAttachments((prev) =>
              prev.map((item) =>
                item.id === id
                  ? { ...item, status: "error", errorMessage: errorMsg }
                  : item
              )
            )
          })
      }
    },
    [attachments.length, uploadMutation]
  )

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : []
    if (files.length > 0) {
      handleProcessFiles(files)
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => {
      const item = prev.find((a) => a.id === id)
      if (item) {
        URL.revokeObjectURL(item.previewUrl)
        // Delete from Supabase storage if it was already uploaded
        if (item.uploadedPath) {
          deleteMutation.mutate(item.uploadedPath)
        }
      }
      return prev.filter((a) => a.id !== id)
    })
  }

  // Paste images from clipboard
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items
    if (!items) return

    const files: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item && item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }

    if (files.length > 0) {
      event.preventDefault()
      handleProcessFiles(files)
    }
  }

  const handleSubmit = React.useCallback(() => {
    if (!canSubmit) return

    const rawText = text.trim()
    let finalPrompt = rawText
    if (replyTarget && rawText) {
      const quoted = replyTarget.text
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n")
      finalPrompt = `${quoted}\n\n${rawText}`
    }

    const uploadedUrls = attachments
      .filter((a) => a.status === "done" && !!a.uploadedUrl)
      .map((a) => a.uploadedUrl!)

    onSend(finalPrompt, uploadedUrls.length > 0 ? uploadedUrls : undefined)

    // Clean up preview blob URLs
    for (const a of attachments) {
      URL.revokeObjectURL(a.previewUrl)
    }
    setAttachments([])
    setText("")
    onClearReply?.()

    requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
  }, [canSubmit, text, replyTarget, attachments, onSend, onClearReply])

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
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={disabled || attachments.length >= MAX_IMAGES}
            />

            {/* Replying banner */}
            {replyTarget && (
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2 text-xs">
                <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <ArrowToDownLeft className="size-3.5 shrink-0 text-primary" />
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
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
            )}

            {/* Attachment preview group */}
            {attachments.length > 0 && (
              <div className="border-b border-border/50 p-2 px-3">
                <AttachmentGroup className="gap-2">
                  {attachments.map((att) => (
                    <Attachment
                      key={att.id}
                      size="sm"
                      state={att.status}
                      className="group/item relative overflow-hidden"
                    >
                      <AttachmentMedia variant="image" className="size-12!">
                        <img
                          src={att.previewUrl}
                          alt={att.file.name}
                          className="size-full object-cover"
                        />
                      </AttachmentMedia>
                      <AttachmentContent className="max-w-30 truncate">
                        <AttachmentTitle>{att.file.name}</AttachmentTitle>
                        <AttachmentDescription>
                          {att.status}
                        </AttachmentDescription>
                      </AttachmentContent>
                      <AttachmentActions>
                        <AttachmentAction
                          variant="secondary"
                          size="icon-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveAttachment(att.id)
                          }}
                          className="size-5 rounded-full bg-background/80 shadow-xs hover:bg-background"
                          title="Remove image"
                          aria-label="Remove image"
                        >
                          <X className="size-3" />
                        </AttachmentAction>
                      </AttachmentActions>
                    </Attachment>
                  ))}
                </AttachmentGroup>
              </div>
            )}

            <div className="flex items-end">
              {/* Attach image button */}
              <div className="p-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                  disabled={disabled || attachments.length >= MAX_IMAGES}
                  className="size-8 rounded-full text-muted-foreground hover:text-foreground"
                  title={
                    attachments.length >= MAX_IMAGES
                      ? `Maximum ${MAX_IMAGES} images attached`
                      : "Add images (max 10, up to 5MB each)"
                  }
                  aria-label="Attach images"
                >
                  <Plus className="size-4" />
                </Button>
              </div>

              <Textarea
                ref={textareaRef}
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={
                  replyTarget
                    ? `Reply to ${replyTarget.sender}...`
                    : attachments.length > 0
                      ? "Add a message or press enter to send..."
                      : placeholder
                }
                disabled={disabled}
                rows={1}
                className="max-h-48 min-h-12 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-2 py-3.5 pr-14 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />

              <div className="p-2">
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
                      <Stop3 className="size-4" />
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
                    {isSubmitting || isUploadingAny ? (
                      <Spinner className="size-4" />
                    ) : (
                      <ArrowUp className="size-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
