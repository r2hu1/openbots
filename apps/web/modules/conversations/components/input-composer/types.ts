import type * as React from "react";
import type { AttachmentItem } from "../../types";

export interface SlashCommand {
  name: string;
  label: string;
  insertText: string;
  description: string;
  category?: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const MAX_ATTACHMENTS = 10;
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export interface UploadingAttachment {
  id: string;
  file: File;
  previewUrl?: string;
  uploadedUrl?: string;
  uploadedPath?: string;
  name: string;
  mimeType?: string;
  sizeBytes: number;
  isImage: boolean;
  status: "uploading" | "done" | "error";
  errorMessage?: string;
}

export interface InputComposerProps {
  onSend: (
    prompt: string,
    images?: string[],
    attachments?: AttachmentItem[],
  ) => void;
  isSubmitting?: boolean;
  isActiveRun?: boolean;
  onCancelRun?: () => void;
  isCancelling?: boolean;
  placeholder?: string;
  disabled?: boolean;
  replyTarget?: import("../../types").ReplyTarget | null;
  onClearReply?: () => void;
}
