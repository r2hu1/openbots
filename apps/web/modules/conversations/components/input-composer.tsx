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
  CodeFile,
  Diagram,
  DocumentText,
  DocumentUpload,
  FilePdf,
  Gallery,
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
import type { AttachmentItem, ReplyTarget } from "../types"
import { cn } from "@/lib/utils"
import { Kbd } from "@openbots/ui/components/kbd"
import { formatFileSize } from "../utils"

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

const MAX_ATTACHMENTS = 10
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB

interface UploadingAttachment {
  id: string
  file: File
  previewUrl?: string
  uploadedUrl?: string
  uploadedPath?: string
  name: string
  mimeType?: string
  sizeBytes: number
  isImage: boolean
  status: "uploading" | "done" | "error"
  errorMessage?: string
}

interface InputComposerProps {
  onSend: (
    prompt: string,
    images?: string[],
    attachments?: AttachmentItem[]
  ) => void
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
  const [attachments, setAttachments] = React.useState<UploadingAttachment[]>(
    []
  )
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [isDismissed, setIsDismissed] = React.useState(false)
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const dragCounterRef = React.useRef(0)

  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const commandListRef = React.useRef<HTMLDivElement>(null)

  const uploadMutation = useUploadConversationImageMutation()
  const deleteMutation = useDeleteConversationImageMutation()

  const isUploadingAny = attachments.some((att) => att.status === "uploading")
  const hasValidAttachments = attachments.some((att) => att.status === "done")
  const isDisabled = disabled || isSubmitting
  const canSubmit =
    (text.trim().length > 0 || hasValidAttachments) &&
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
      if (files.length === 0) return

      const remainingSlots = MAX_ATTACHMENTS - attachments.length

      if (remainingSlots <= 0) {
        toast.add({
          title: "Limit reached",
          description: `You can attach at most ${MAX_ATTACHMENTS} files at a time.`,
          type: "warning",
        })
        return
      }

      const filesToProcess = files.slice(0, remainingSlots)

      if (files.length > remainingSlots) {
        toast.add({
          title: "Too many files",
          description: `Only the first ${remainingSlots} files were added (${MAX_ATTACHMENTS} max).`,
          type: "warning",
        })
      }

      for (const file of filesToProcess) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          toast.add({
            title: "File too large",
            description: `"${file.name}" exceeds the 25MB size limit.`,
            type: "error",
          })
          continue
        }

        const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        const isImage = file.type.startsWith("image/")
        const previewUrl = isImage ? URL.createObjectURL(file) : undefined

        const newAttachment: UploadingAttachment = {
          id,
          file,
          previewUrl,
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          isImage,
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
                      name: res.name || item.name,
                      mimeType: res.mimeType || item.mimeType,
                      sizeBytes: res.sizeBytes ?? item.sizeBytes,
                    }
                  : item
              )
            )
          })
          .catch((err) => {
            console.error("Upload error:", err)

            const errorMsg =
              err?.message || "Failed to upload file. Please try again."

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
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl)
        }

        // Delete from Supabase storage if it was already uploaded
        if (item.uploadedPath) {
          deleteMutation.mutate(item.uploadedPath)
        }
      }

      return prev.filter((a) => a.id !== id)
    })
  }

  // Paste images and files from clipboard
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items
    if (!items) return

    const files: File[] = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      if (item && item.kind === "file") {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }

    if (files.length > 0) {
      event.preventDefault()
      handleProcessFiles(files)
    }
  }

  // Full-page drag and drop support
  React.useEffect(() => {
    const onDragEnter = (event: DragEvent) => {
      event.preventDefault()
      dragCounterRef.current += 1
      if (event.dataTransfer?.types?.includes("Files")) {
        setIsDragging(true)
      }
    }

    const onDragOver = (event: DragEvent) => {
      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy"
      }
    }

    const onDragLeave = (event: DragEvent) => {
      event.preventDefault()
      dragCounterRef.current -= 1
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0
        setIsDragging(false)
      }
    }

    const onDrop = (event: DragEvent) => {
      event.preventDefault()
      dragCounterRef.current = 0
      setIsDragging(false)

      if (disabled || isSubmitting) return

      const dt = event.dataTransfer
      if (!dt) return

      const files = dt.files ? Array.from(dt.files) : []
      if (files.length > 0) {
        handleProcessFiles(files)
      }
    }

    window.addEventListener("dragenter", onDragEnter)
    window.addEventListener("dragover", onDragOver)
    window.addEventListener("dragleave", onDragLeave)
    window.addEventListener("drop", onDrop)

    return () => {
      window.removeEventListener("dragenter", onDragEnter)
      window.removeEventListener("dragover", onDragOver)
      window.removeEventListener("dragleave", onDragLeave)
      window.removeEventListener("drop", onDrop)
    }
  }, [disabled, isSubmitting, handleProcessFiles])

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

    const uploadedImages = attachments
      .filter((a) => a.status === "done" && a.isImage && !!a.uploadedUrl)
      .map((a) => a.uploadedUrl!)

    const uploadedDocs: AttachmentItem[] = attachments
      .filter((a) => a.status === "done" && !!a.uploadedUrl)
      .map((a) => ({
        url: a.uploadedUrl!,
        path: a.uploadedPath || "",
        name: a.name,
        mimeType: a.mimeType || "application/octet-stream",
        sizeBytes: a.sizeBytes,
      }))

    onSend(
      finalPrompt,
      uploadedImages.length > 0 ? uploadedImages : undefined,
      uploadedDocs.length > 0 ? uploadedDocs : undefined
    )

    // Clean up preview blob URLs
    for (const a of attachments) {
      if (a.previewUrl) {
        URL.revokeObjectURL(a.previewUrl)
      }
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

        {/* Full-Page Drag and Drop Visual Overlay */}
        {isDragging && (
          <div className="pointer-events-none fixed inset-0 z-99 flex animate-in flex-col items-center justify-center gap-3 bg-background/75 backdrop-blur-sm duration-150 fade-in-0">
            <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-muted/50 text-foreground">
              <DocumentUpload className="size-6" />
            </div>

            <div className="text-center">
              <h3 className="text-sm font-medium text-foreground">
                Drop files to upload
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Images, documents, spreadsheets, or code
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Up to 10 files · 25 MB each
              </p>
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
              "relative flex cursor-text flex-col overflow-hidden rounded-2xl border bg-sidebar transition-all duration-200 focus-within:border-foreground/20 focus-within:ring-3 focus-within:ring-border dark:bg-border/40",
              isDragging && "border-primary/80 ring-3 ring-primary/20"
            )}
          >
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.json,image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={disabled || attachments.length >= MAX_ATTACHMENTS}
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
                  {attachments.map((att) => {
                    const isPdf =
                      att.mimeType === "application/pdf" ||
                      att.name.endsWith(".pdf")
                    const isCode =
                      att.mimeType?.includes("json") ||
                      att.mimeType?.includes("code") ||
                      att.name.endsWith(".json") ||
                      att.name.endsWith(".js") ||
                      att.name.endsWith(".ts") ||
                      att.name.endsWith(".py")
                    const isSpreadsheet =
                      att.mimeType?.includes("spreadsheet") ||
                      att.mimeType?.includes("excel") ||
                      att.mimeType?.includes("csv") ||
                      att.name.endsWith(".xlsx") ||
                      att.name.endsWith(".xls") ||
                      att.name.endsWith(".csv")

                    return (
                      <Attachment
                        key={att.id}
                        size="sm"
                        state={att.status}
                        className="group/item relative overflow-hidden rounded-lg"
                      >
                        {att.isImage && att.previewUrl ? (
                          <AttachmentMedia variant="image" className="size-10!">
                            <img
                              src={att.previewUrl}
                              alt={att.name}
                              className="size-full object-cover"
                            />
                          </AttachmentMedia>
                        ) : (
                          <AttachmentMedia variant="icon" className="size-10!">
                            {isPdf ? (
                              <FilePdf className="size-5" />
                            ) : isCode ? (
                              <CodeFile className="size-5" />
                            ) : isSpreadsheet ? (
                              <DocumentText className="size-5" />
                            ) : (
                              <DocumentText className="size-5" />
                            )}
                          </AttachmentMedia>
                        )}

                        <AttachmentContent className="max-w-36 truncate">
                          <AttachmentTitle>{att.name}</AttachmentTitle>

                          <AttachmentDescription>
                            {att.status === "uploading"
                              ? "uploading..."
                              : formatFileSize(att.sizeBytes) || att.status}
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
                            title="Remove attachment"
                            aria-label="Remove attachment"
                          >
                            <X className="size-3" />
                          </AttachmentAction>
                        </AttachmentActions>
                      </Attachment>
                    )
                  })}
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
                disabled={disabled || attachments.length >= MAX_ATTACHMENTS}
                className="absolute bottom-2.5 left-2 size-8 rounded-full text-muted-foreground transition-transform hover:bg-muted hover:text-foreground active:scale-95"
                title={
                  attachments.length >= MAX_ATTACHMENTS
                    ? `Maximum ${MAX_ATTACHMENTS} files attached`
                    : "Add files (max 10, up to 25MB each)"
                }
                aria-label="Attach files"
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
                disabled={disabled}
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
