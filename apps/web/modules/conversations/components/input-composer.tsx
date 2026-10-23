"use client"

import { Textarea } from "@openbots/ui/components/textarea"
import * as React from "react"
import { cn } from "@/lib/utils"
import { AttachmentPreview } from "./input-composer/attachment-preview"
import { ComposerToolbar } from "./input-composer/composer-toolbar"
import { DragDropOverlay } from "./input-composer/drag-drop-overlay"
import { ModelPicker } from "./input-composer/model-picker"
import { ReplyingBanner } from "./input-composer/replying-banner"
import { SlashCommandMenu } from "./input-composer/slash-command-menu"
import { MAX_ATTACHMENTS } from "./input-composer/types"
import type { InputComposerProps } from "./input-composer/types"
import { useComposerAttachments } from "./input-composer/use-composer-attachments"
import { useComposerAutoResize } from "./input-composer/use-composer-auto-resize"
import { useComposerDragDrop } from "./input-composer/use-composer-drag-drop"
import { useComposerShortcuts } from "./input-composer/use-composer-shortcuts"
import { useComposerSubmit } from "./input-composer/use-composer-submit"
import { useSlashCommands } from "./input-composer/use-slash-commands"
import { VoiceInput } from "./input-composer/voice-input"

export { SLASH_COMMANDS } from "./input-composer/slash-commands"
export type { SlashCommand, InputComposerProps } from "./input-composer/types"

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

  const {
    attachments,
    fileInputRef,
    handleProcessFiles,
    handleFileChange,
    handleRemoveAttachment,
    clearAttachments,
  } = useComposerAttachments()

  const {
    isMenuOpen,
    filteredCommands,
    selectedIndex,
    setSelectedIndex,
    setIsDismissed,
    commandListRef,
    handleSelectCommand,
  } = useSlashCommands({
    text,
    setText,
    textareaRef,
  })

  const { isDragging } = useComposerDragDrop({
    disabled,
    isSubmitting,
    onProcessFiles: handleProcessFiles,
  })

  const {
    isUploadingAny,
    canSubmit,
    handleSubmit,
    handleKeyDown,
    handlePaste,
  } = useComposerSubmit({
    text,
    setText,
    attachments,
    clearAttachments,
    replyTarget,
    onClearReply,
    onSend,
    disabled,
    isSubmitting,
    isActiveRun,
    textareaRef,
    isMenuOpen,
    filteredCommands,
    selectedIndex,
    setSelectedIndex,
    setIsDismissed,
    handleSelectCommand,
    onProcessFiles: handleProcessFiles,
  })

  const { isExpanded } = useComposerAutoResize({
    text,
    textareaRef,
  })

  useComposerShortcuts({
    textareaRef,
    replyTarget,
  })

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value)
    setIsDismissed(false)
  }

  const handleContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return
    textareaRef.current?.focus()
  }

  const isAttachDisabled = disabled || attachments.length >= MAX_ATTACHMENTS
  const attachTitle =
    attachments.length >= MAX_ATTACHMENTS
      ? `Maximum ${MAX_ATTACHMENTS} files attached`
      : "Add files (max 10, up to 25MB each)"

  return (
    <div className="w-full px-3 pb-3">
      <div className="relative mx-auto max-w-[870px]">
        {/* Slash Commands Floating Menu */}
        <SlashCommandMenu
          isOpen={isMenuOpen}
          commands={filteredCommands}
          selectedIndex={selectedIndex}
          onSelectIndex={setSelectedIndex}
          onSelectCommand={handleSelectCommand}
          commandListRef={commandListRef}
        />

        {/* Full-Page Drag and Drop Visual Overlay */}
        <DragDropOverlay isDragging={isDragging} />

        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit()
          }}
        >
          <div
            onClick={handleContainerClick}
            className="relative flex cursor-text flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 focus-within:border-foreground/20"
          >
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.json,image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={isAttachDisabled}
            />

            {/* Replying banner */}
            <ReplyingBanner
              replyTarget={replyTarget ?? null}
              onClearReply={onClearReply}
            />

            {/* Attachment preview group */}
            <AttachmentPreview
              attachments={attachments}
              onRemove={handleRemoveAttachment}
            />

            <div
              className={cn(
                "relative p-2.5 transition-[padding] duration-200 ease-out motion-reduce:transition-none",
                isExpanded ? "pb-10" : "pb-[9px]"
              )}
            >
              <ComposerToolbar
                onAttachClick={(e: React.MouseEvent) => {
                  e.stopPropagation()
                  fileInputRef.current?.click()
                }}
                isAttachDisabled={isAttachDisabled}
                attachTitle={attachTitle}
                isActiveRun={isActiveRun}
                onCancelRun={onCancelRun}
                isCancelling={isCancelling}
                canSubmit={canSubmit}
                isSubmitting={isSubmitting}
                isUploadingAny={isUploadingAny}
              />

              <VoiceInput disabled={disabled} />
              <ModelPicker disabled={disabled} />

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
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
