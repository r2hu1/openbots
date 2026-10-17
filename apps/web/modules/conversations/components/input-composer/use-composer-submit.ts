"use client";

import * as React from "react";
import type { AttachmentItem, ReplyTarget } from "../../types";
import type { SlashCommand, UploadingAttachment } from "./types";

interface UseComposerSubmitOptions {
  text: string;
  setText: React.Dispatch<React.SetStateAction<string>>;
  attachments: UploadingAttachment[];
  clearAttachments: () => void;
  replyTarget?: ReplyTarget | null;
  onClearReply?: () => void;
  onSend: (
    prompt: string,
    images?: string[],
    attachments?: AttachmentItem[],
  ) => void;
  disabled?: boolean;
  isSubmitting?: boolean;
  isActiveRun?: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  isMenuOpen: boolean;
  filteredCommands: SlashCommand[];
  selectedIndex: number;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  setIsDismissed: (dismissed: boolean) => void;
  handleSelectCommand: (command: SlashCommand) => void;
  onProcessFiles: (files: File[]) => void;
}

export function useComposerSubmit({
  text,
  setText,
  attachments,
  clearAttachments,
  replyTarget,
  onClearReply,
  onSend,
  disabled = false,
  isSubmitting = false,
  isActiveRun = false,
  textareaRef,
  isMenuOpen,
  filteredCommands,
  selectedIndex,
  setSelectedIndex,
  setIsDismissed,
  handleSelectCommand,
  onProcessFiles,
}: UseComposerSubmitOptions) {
  const isUploadingAny = attachments.some((att) => att.status === "uploading");
  const hasValidAttachments = attachments.some((att) => att.status === "done");
  const isDisabled = disabled || isSubmitting;
  const canSubmit =
    (text.trim().length > 0 || hasValidAttachments) &&
    !isDisabled &&
    !isActiveRun &&
    !isUploadingAny;

  const handleSubmit = React.useCallback(() => {
    if (!canSubmit) return;

    const rawText = text.trim();
    let finalPrompt = rawText;

    if (replyTarget && rawText) {
      const quoted = replyTarget.text
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n");

      finalPrompt = `${quoted}\n\n${rawText}`;
    }

    const uploadedImages = attachments
      .filter((a) => a.status === "done" && a.isImage && !!a.uploadedUrl)
      .map((a) => a.uploadedUrl!);

    const uploadedDocs: AttachmentItem[] = attachments
      .filter((a) => a.status === "done" && !!a.uploadedUrl)
      .map((a) => ({
        url: a.uploadedUrl!,
        path: a.uploadedPath || "",
        name: a.name,
        mimeType: a.mimeType || "application/octet-stream",
        sizeBytes: a.sizeBytes,
      }));

    onSend(
      finalPrompt,
      uploadedImages.length > 0 ? uploadedImages : undefined,
      uploadedDocs.length > 0 ? uploadedDocs : undefined,
    );

    clearAttachments();
    setText("");
    setIsDismissed(false);
    onClearReply?.();

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [
    canSubmit,
    text,
    replyTarget,
    attachments,
    onSend,
    clearAttachments,
    setText,
    setIsDismissed,
    onClearReply,
    textareaRef,
  ]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;

    if (isMenuOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex(
          (prev) =>
            (prev - 1 + filteredCommands.length) % filteredCommands.length,
        );
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const selected = filteredCommands[selectedIndex];
        if (selected) {
          handleSelectCommand(selected);
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setIsDismissed(true);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    } else if (event.key === "Escape" && replyTarget && !text) {
      event.preventDefault();
      onClearReply?.();
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      event.preventDefault();
      onProcessFiles(files);
    }
  };

  return {
    isUploadingAny,
    canSubmit,
    handleSubmit,
    handleKeyDown,
    handlePaste,
  };
}
