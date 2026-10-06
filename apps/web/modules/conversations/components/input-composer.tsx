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
  Calculator,
  Calendar,
  Chart,
  ClipboardCheck,
  Clock,
  Cloud,
  Code,
  Diagram,
  Dollar,
  FileText,
  Fingerprint,
  Globe,
  ListCheck,
  Plus,
  Scale,
  Scan,
  Search2,
  Send,
  Server,
  Shuffle,
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
  description: string
  category?: "agent" | "tool"
  icon: React.ComponentType<{ className?: string }>
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // Agent & Workflow Commands
  {
    name: "code",
    label: "/code",
    description: "Write or modify code",
    category: "agent",
    icon: Code,
  },
  {
    name: "research",
    label: "/research",
    description: "Deep research and synthesis",
    category: "agent",
    icon: Search2,
  },
  {
    name: "review",
    label: "/review",
    description: "Review code for bugs and improvements",
    category: "agent",
    icon: ClipboardCheck,
  },
  {
    name: "schedule",
    label: "/schedule",
    description: "Schedule a task, reminder, or delayed job",
    category: "tool",
    icon: Calendar,
  },
  {
    name: "tasks",
    label: "/tasks",
    description: "Show and manage scheduled tasks",
    category: "tool",
    icon: ListCheck,
  },
  {
    name: "chart",
    label: "/chart",
    description: "Create an interactive chart from data",
    category: "agent",
    icon: Chart,
  },
  {
    name: "graph",
    label: "/graph",
    description: "Plot an equation or mathematical function",
    category: "agent",
    icon: Activity,
  },
  {
    name: "diagram",
    label: "/diagram",
    description: "Create a visual diagram or flowchart",
    category: "agent",
    icon: Diagram,
  },
  {
    name: "analyze",
    label: "/analyze",
    description: "Analyze the attached file or image",
    category: "agent",
    icon: Scan,
  },

  // Internal Tools
  {
    name: "web_search",
    label: "/web_search",
    description: "Search the web for real-time information",
    category: "tool",
    icon: Search2,
  },
  {
    name: "fetch_web_page",
    label: "/fetch_web_page",
    description: "Extract clean content from a public web page",
    category: "tool",
    icon: Globe,
  },
  {
    name: "http_request",
    label: "/http_request",
    description: "Perform an HTTP request to any JSON REST API",
    category: "tool",
    icon: Send,
  },
  {
    name: "calculate",
    label: "/calculate",
    description: "Evaluate a mathematical arithmetic expression",
    category: "tool",
    icon: Calculator,
  },
  {
    name: "execute_code",
    label: "/execute_code",
    description: "Execute a JavaScript expression or computation",
    category: "tool",
    icon: Code,
  },
  {
    name: "get_weather",
    label: "/get_weather",
    description: "Get real-time weather and forecast for a location",
    category: "tool",
    icon: Cloud,
  },
  {
    name: "wikipedia_search",
    label: "/wikipedia_search",
    description: "Search Wikipedia articles and summaries",
    category: "tool",
    icon: Book,
  },
  {
    name: "currency_converter",
    label: "/currency_converter",
    description: "Convert amounts between global fiat currencies",
    category: "tool",
    icon: Dollar,
  },
  {
    name: "unit_converter",
    label: "/unit_converter",
    description: "Convert units of length, mass, temperature, and more",
    category: "tool",
    icon: Scale,
  },
  {
    name: "get_current_time",
    label: "/get_current_time",
    description: "Get current date, time, and timezone information",
    category: "tool",
    icon: Clock,
  },
  {
    name: "text_analyzer",
    label: "/text_analyzer",
    description:
      "Analyze text statistics (word count, reading time, readability)",
    category: "tool",
    icon: FileText,
  },
  {
    name: "transform_text",
    label: "/transform_text",
    description: "Transform text casing, slugify, or base64 encode/decode",
    category: "tool",
    icon: FileText,
  },
  {
    name: "json_parser",
    label: "/json_parser",
    description: "Validate, format, minify, or query JSON data",
    category: "tool",
    icon: Code,
  },
  {
    name: "dns_lookup",
    label: "/dns_lookup",
    description: "Look up DNS records (A, AAAA, MX, TXT, CNAME) for a domain",
    category: "tool",
    icon: Server,
  },
  {
    name: "generate_uuid",
    label: "/generate_uuid",
    description: "Generate cryptographically secure v4 UUIDs",
    category: "tool",
    icon: Fingerprint,
  },
  {
    name: "random_generator",
    label: "/random_generator",
    description: "Generate random numbers, strings, coin flips, or dice rolls",
    category: "tool",
    icon: Shuffle,
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

    if (text.length === 0 && isExpanded) setIsExpanded(false)

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
    el.style.height = `${Math.min(full, 240)}px`
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
      if (!slashMatch) {
        setText(`${command.label} `)
      } else {
        const before = text.slice(0, slashMatch.startIndex)
        const newText = `${before}${command.label} `
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
    <div className="w-full px-3 pb-4">
      <div className="relative mx-auto max-w-3xl">
        {/* Slash Commands Floating Menu */}
        {isMenuOpen && (
          <div
            ref={commandListRef}
            role="listbox"
            aria-label="Slash commands"
            className="absolute bottom-full left-0 z-50 mb-2 w-full max-w-md animate-in overflow-hidden rounded-lg border border-border/60 bg-popover shadow-[0_4px_24px_rgba(0,0,0,0.08)] duration-150 fade-in-0 outline-none zoom-in-95 slide-in-from-bottom-1"
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
                        <span className="font-medium text-foreground">
                          {command.label}
                        </span>
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {command.description}
                        </p>
                      </div>
                    </div>
                    {command.category && (
                      <span className="shrink-0 text-[10px] font-medium text-muted-foreground/60 uppercase">
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
            className="flex cursor-text flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_2px_12px_rgba(0,0,0,0.04)] ring-border transition-shadow duration-200 focus-within:border-border focus-within:shadow-[0_4px_24px_rgba(0,0,0,0.09)] focus-within:ring-2 hover:shadow-[0_4px_20px_rgba(0,0,0,0.07)]"
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
              <div className="mx-3 mt-3 flex animate-in items-center justify-between rounded-xl bg-muted px-3 py-2 text-xs fade-in-0 slide-in-from-bottom-1">
                <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <ArrowToDownLeft className="size-3.5 shrink-0" />
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
              <div className="px-3.5 pt-3">
                <AttachmentGroup className="gap-2">
                  {attachments.map((att) => (
                    <Attachment
                      key={att.id}
                      size="sm"
                      state={att.status}
                      className="group/item relative overflow-hidden rounded-xl"
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

            <div
              className={cn(
                "relative p-2 transition-[padding] duration-200 ease-out motion-reduce:transition-none",
                isExpanded ? "pb-12" : "pb-2"
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
                className="absolute bottom-3 left-2 size-8 rounded-lg text-muted-foreground transition-transform hover:bg-muted hover:text-foreground active:scale-95"
                title={
                  attachments.length >= MAX_IMAGES
                    ? `Maximum ${MAX_IMAGES} images attached`
                    : "Add images (max 10, up to 5MB each)"
                }
                aria-label="Attach images"
              >
                <Plus className="size-[18px]" />
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
                  "block field-sizing-fixed max-h-60 min-h-0 w-full resize-none rounded-none border-0 bg-transparent! py-2 text-[15px] leading-6 shadow-none transition-[height] duration-200 ease-out placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0 motion-reduce:transition-none",
                  isExpanded ? "px-2.5" : "px-10"
                )}
              />

              {/* Send / stop */}
              {isActiveRun && onCancelRun ? (
                <Button
                  type="button"
                  size="icon"
                  onClick={onCancelRun}
                  disabled={isCancelling}
                  className="absolute right-2 bottom-3 size-8 rounded-lg transition-transform active:scale-95"
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
                  className="absolute right-2 bottom-3 size-8 rounded-lg transition-[opacity,transform] active:scale-95 disabled:opacity-40"
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
        </form>
      </div>
    </div>
  )
}
