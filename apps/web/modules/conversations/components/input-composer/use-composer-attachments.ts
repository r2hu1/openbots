"use client";

import { toast } from "@openbots/ui/components/toast";
import * as React from "react";
import {
  useDeleteConversationImageMutation,
  useUploadConversationImageMutation,
} from "../../queries";
import { MAX_ATTACHMENTS, MAX_FILE_SIZE_BYTES } from "./types";
import type { UploadingAttachment } from "./types";

export function useComposerAttachments() {
  const [attachments, setAttachments] = React.useState<UploadingAttachment[]>(
    [],
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadConversationImageMutation();
  const deleteMutation = useDeleteConversationImageMutation();

  const handleProcessFiles = React.useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const remainingSlots = MAX_ATTACHMENTS - attachments.length;

      if (remainingSlots <= 0) {
        toast.add({
          title: "Limit reached",
          description: `You can attach at most ${MAX_ATTACHMENTS} files at a time.`,
          type: "warning",
        });
        return;
      }

      const filesToProcess = files.slice(0, remainingSlots);

      if (files.length > remainingSlots) {
        toast.add({
          title: "Too many files",
          description: `Only the first ${remainingSlots} files were added (${MAX_ATTACHMENTS} max).`,
          type: "warning",
        });
      }

      for (const file of filesToProcess) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          toast.add({
            title: "File too large",
            description: `"${file.name}" exceeds the 25MB size limit.`,
            type: "error",
          });
          continue;
        }

        const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const isImage = file.type.startsWith("image/");
        const previewUrl = isImage ? URL.createObjectURL(file) : undefined;

        const newAttachment: UploadingAttachment = {
          id,
          file,
          previewUrl,
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          isImage,
          status: "uploading",
        };

        setAttachments((prev) => [...prev, newAttachment]);

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
                  : item,
              ),
            );
          })
          .catch((err) => {
            console.error("Upload error:", err);

            const errorMsg =
              err?.message || "Failed to upload file. Please try again.";

            toast.add({
              title: "Upload failed",
              description: `Could not upload "${file.name}": ${errorMsg}`,
              type: "error",
            });

            setAttachments((prev) =>
              prev.map((item) =>
                item.id === id
                  ? { ...item, status: "error", errorMessage: errorMsg }
                  : item,
              ),
            );
          });
      }
    },
    [attachments.length, uploadMutation],
  );

  const handleFileChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? Array.from(event.target.files) : [];
      if (files.length > 0) {
        handleProcessFiles(files);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleProcessFiles],
  );

  const handleRemoveAttachment = React.useCallback(
    (id: string) => {
      setAttachments((prev) => {
        const item = prev.find((a) => a.id === id);
        if (item) {
          if (item.previewUrl) {
            URL.revokeObjectURL(item.previewUrl);
          }
          if (item.uploadedPath) {
            deleteMutation.mutate(item.uploadedPath);
          }
        }
        return prev.filter((a) => a.id !== id);
      });
    },
    [deleteMutation],
  );

  const clearAttachments = React.useCallback(() => {
    for (const a of attachments) {
      if (a.previewUrl) {
        URL.revokeObjectURL(a.previewUrl);
      }
    }
    setAttachments([]);
  }, [attachments]);

  return {
    attachments,
    fileInputRef,
    handleProcessFiles,
    handleFileChange,
    handleRemoveAttachment,
    clearAttachments,
  };
}
