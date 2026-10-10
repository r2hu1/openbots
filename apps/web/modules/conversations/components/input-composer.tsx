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
  Activity,
  ArrowToDownLeft,
  ArrowUp,
  Book,
  Calendar,
  Chart,
  ClipboardCheck,
  Code,
  Diagram,
  ListCheck,
  Plus,
  Scan,
  Search2,
  Stop3,
  X,
} from "reicon-react"
import {
  useDeleteConversationImageMutation,
  useUploadConversationImageMutation,
} from "../queries"
import type { ReplyTarget } from "../types"
import { cn } from "@/lib/utils"
import { Kbd } from "@openbots/ui/components/kbd"

export interface SlashCommand {
  name: string
  label: string
  insertText: string
  description: string
  category?: string
  icon: React.ComponentType<{ className?: string }>
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "web_search",
    label: "Web Search",
    insertText: "/search",
    description: "Search the web for up-to-date facts, news, and links",
    category: "browse",
    icon: Search2,
  },
  {
    name: "research",
    label: "Deep Research",
    insertText: "/research",
    description:
      "Multi-source research, authoritative synthesis, and citations",
    category: "research",
    icon: Book,
  },
  {
    name: "schedule",
    label: "Schedule Task",
    insertText: "/schedule",
    description:
      "Set reminders, delayed alarms, or background recurring cron jobs",
    category: "schedule",
    icon: Calendar,
  },
  {
    name: "tasks",
    label: "View Tasks",
    insertText: "/tasks",
    description: "Show and manage active and recurring scheduled tasks",
    category: "schedule",
    icon: ListCheck,
  },
  {
    name: "chart",
    label: "Create Chart",
    insertText: "/chart",
    description: "Generate interactive visual charts and data breakdowns",
    category: "visual",
    icon: Chart,
  },
  {
    name: "diagram",
    label: "Create Diagram",
    insertText: "/diagram",
    description: "Generate architecture flowcharts and sequence diagrams",
    category: "visual",
    icon: Diagram,
  },
  {
    name: "graph",
    label: "Plot Graph",
    insertText: "/graph",
    description: "Plot equations, mathematical models, or network graphs",
    category: "visual",
    icon: Activity,
  },
  {
    name: "code",
    label: "Write Code",
    insertText: "/code",
    description: "Write, build, or refactor code cleanly",
    category: "coding",
    icon: Code,
  },
  {
    name: "review",
    label: "Code Review",
    insertText: "/review",
    description:
      "Inspect code for improvements, performance, and security bugs",
    category: "coding",
    icon: ClipboardCheck,
  },
  {
    name: "analyze",
    label: "Analyze File",
    insertText: "/analyze",
    description: "Analyze and extract insights from attached images or files",
    category: "file",
    icon: Scan,
  },
]

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
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [isDismissed, setIsDismissed] = React.useState(false)
  const [isExpanded, setIsExpanded] = React.useState(false)

  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const commandListRef = React.useRef<HTMLDivElement>(null)

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

  // Auto-resize (animated) + switch between inline and expanded layout.
  // Expands on newline or when text wraps; collapses only when emptied
  // (latched, so widening the textarea can't cause flip-flopping).
  React.useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return

    if (text.length === 0) {
      if (isExpanded) setIsExpanded(false)
      el.style.height = "32px"
      el.style.overflowY = "hidden"
      return
    }

    const prev = el.offsetHeight
    el.style.height = "auto"
    const full = el.scrollHeight

    if (!isExpanded && text.length > 0 && (text.includes("\n") || full > 44)) {
      setIsExpanded(true)
    }

    el.style.overflowY = full > 240 ? "auto" : "hidden"

    // Restore previous height, force reflow, then set the target so the
    // CSS height transition has something to animate from.
    el.style.height = `${prev}px`
    void el.offsetHeight
    el.style.height = `${Math.min(Math.max(full, 32), 240)}px`
  }, [text, isExpanded])

  // Check if user is typing a slash command:
  const slashMatch = React.useMemo(() => {
    if (isDismissed) return null

    const match = text.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/)
    if (!match) return null

    return {
      query: (match[1] ?? "").toLowerCase(),
      startIndex: match.index! + (match[0].startsWith(" ") ? 1 : 0),
    }
  }, [text, isDismissed])

  const filteredCommands = React.useMemo(() => {
    if (!slashMatch) return []

    const q = slashMatch.query
    if (!q) return SLASH_COMMANDS

    return SLASH_COMMANDS.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(q) ||
        cmd.label.toLowerCase().includes(q) ||
        cmd.insertText.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q)
    )
  }, [slashMatch])

  const isMenuOpen = slashMatch !== null && filteredCommands.length > 0

  // Reset selected index when filtered list changes
  React.useEffect(() => {
    setSelectedIndex(0)
  }, [filteredCommands.length])

  // Scroll active command into view
  React.useEffect(() => {
    if (!isMenuOpen || !commandListRef.current) return

    const activeItem = commandListRef.current.querySelector(
      `[data-index="${selectedIndex}"]`
    ) as HTMLElement | null

    if (activeItem) {
      activeItem.scrollIntoView({ block: "nearest" })
    }
  }, [selectedIndex, isMenuOpen])

  // Select a command and insert into text
  const handleSelectCommand = React.useCallback(
    (command: SlashCommand) => {
      const insertion = `${command.insertText} `
      if (!slashMatch) {
        setText(insertion)
      } else {
        const before = text.slice(0, slashMatch.startIndex)
        const newText = `${before}${insertion}`
        setText(newText)
      }

      setIsDismissed(false)

      requestAnimationFrame(() => {
        const textarea = textareaRef.current
        if (textarea) {
          textarea.focus()
          const length = textarea.value.length
          textarea.setSelectionRange(length, length)
        }
      })
    },
    [slashMatch, text]
  )

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
    setIsDismissed(false)
    onClearReply?.()

    requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
  }, [canSubmit, text, replyTarget, attachments, onSend, onClearReply])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return

    // Handle slash command popover keyboard navigation
    if (isMenuOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length)
        return
      }

      if (event.key === "ArrowUp") {
        event.preventDefault()
        setSelectedIndex(
          (prev) =>
            (prev - 1 + filteredCommands.length) % filteredCommands.length
        )
        return
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault()

        const selected = filteredCommands[selectedIndex]

        if (selected) {
          handleSelectCommand(selected)
        }

        return
      }

      if (event.key === "Escape") {
        event.preventDefault()
        setIsDismissed(true)
        return
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    } else if (event.key === "Escape" && replyTarget && !text) {
      event.preventDefault()
      onClearReply?.()
    }
  }

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value)

    if (isDismissed) {
      setIsDismissed(false)
    }
  }

  const handleContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return
    textareaRef.current?.focus()
  }

  return (
    <div className="w-full px-3 pb-3">
      <div className="relative mx-auto max-w-[870px]">
        {/* Slash Commands Floating Menu */}
        {isMenuOpen && (
          <div
            ref={commandListRef}
            role="listbox"
            aria-label="Slash commands"
            className="dark absolute bottom-full left-0 z-50 mb-2 w-full max-w-md origin-bottom-left animate-in overflow-hidden rounded-lg border border-border/60 bg-popover duration-100 fade-in-0 outline-none slide-in-from-bottom-10 zoom-in-95"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between bg-popover px-3 py-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Commands
              <Kbd>TAB</Kbd>
            </div>

            <div className="max-h-72 w-full space-y-0.5 overflow-y-auto px-1.5 pb-1.5">
              {filteredCommands.map((command, idx) => {
                const isSelected = idx === selectedIndex
                const Icon = command.icon

                return (
                  <button
                    key={command.name}
                    type="button"
                    data-index={idx}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleSelectCommand(command)
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                      isSelected
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-lg",
                          isSelected
                            ? "bg-background text-foreground"
                            : "bg-muted/50 text-muted-foreground"
                        )}
                      >
                        <Icon className="size-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">
                            {command.label}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground/70">
                            {command.insertText}
                          </span>
                        </div>

                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {command.description}
                        </p>
                      </div>
                    </div>

                    {command.category && (
                      <span className="shrink-0 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                        {command.category}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit()
          }}
        >
          <div
            onClick={handleContainerClick}
            className={cn(
              "flex cursor-text flex-col overflow-hidden rounded-2xl border border-border/60 bg-sidebar transition-shadow duration-200 focus-within:border-foreground/20 focus-within:ring-3 focus-within:ring-border"
            )}
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
              <div className="mx-3 mt-2.5 flex animate-in items-center justify-between rounded-lg bg-muted px-2.5 py-1.5 text-xs fade-in-0 slide-in-from-bottom-1">
                <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <ArrowToDownLeft className="size-3 shrink-0" />

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
                    <X className="size-3" />
                  </Button>
                )}
              </div>
            )}

            {/* Attachment preview group */}
            {attachments.length > 0 && (
              <div className="px-3 pt-2.5">
                <AttachmentGroup className="gap-1.5">
                  {attachments.map((att) => (
                    <Attachment
                      key={att.id}
                      size="sm"
                      state={att.status}
                      className="group/item relative overflow-hidden rounded-lg"
                    >
                      <AttachmentMedia variant="image" className="size-10!">
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
                          className="size-5 rounded-full bg-background/80 hover:bg-background"
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

            <div
              className={cn(
                "relative p-2.5 transition-[padding] duration-200 ease-out motion-reduce:transition-none",
                isExpanded ? "pb-10" : "pb-[9px]"
              )}
            >
              {/* Attach */}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  fileInputRef.current?.click()
                }}
                disabled={disabled || attachments.length >= MAX_IMAGES}
                className="absolute bottom-2.5 left-2 size-8 rounded-full text-muted-foreground transition-transform hover:bg-muted hover:text-foreground active:scale-95"
                title={
                  attachments.length >= MAX_IMAGES
                    ? `Maximum ${MAX_IMAGES} images attached`
                    : "Add images (max 10, up to 5MB each)"
                }
                aria-label="Attach images"
              >
                <Plus className="size-4" />
              </Button>

              <Textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={
                  replyTarget
                    ? `Reply to ${replyTarget.sender}...`
                    : attachments.length > 0
                      ? "Add a message or press enter to send..."
                      : placeholder
                }
                disabled={disabled || isActiveRun}
                rows={1}
                className={cn(
                  "block field-sizing-fixed max-h-60 min-h-0 w-full resize-none rounded-none border-0 bg-transparent! py-1.5 text-[14px] leading-5 shadow-none transition-[height] duration-200 ease-out placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0 motion-reduce:transition-none",
                  isExpanded ? "px-2.5" : "px-9"
                )}
              />

              {/* Send / stop */}
              {isActiveRun && onCancelRun ? (
                <Button
                  type="button"
                  size="icon"
                  onClick={onCancelRun}
                  disabled={isCancelling}
                  className="absolute right-2 bottom-2.5 size-8 rounded-full transition-transform active:scale-95"
                  aria-label="Stop run"
                >
                  {isCancelling ? (
                    <Spinner className="size-3.5" />
                  ) : (
                    <Stop3 className="size-3.5" />
                  )}
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={!canSubmit}
                  className="absolute right-2 bottom-2.5 size-8 rounded-full transition-[opacity,transform] active:scale-95 disabled:opacity-40"
                  aria-label="Send message"
                >
                  {isSubmitting || isUploadingAny ? (
                    <Spinner className="size-3.5" />
                  ) : (
                    <ArrowUp className="size-3.5" />
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
