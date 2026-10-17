"use client";

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@openbots/ui/components/attachment";
import { CodeFile, DocumentText, FilePdf, X } from "reicon-react";
import { formatFileSize } from "../../utils";
import type { UploadingAttachment } from "./types";

interface AttachmentPreviewProps {
  attachments: UploadingAttachment[];
  onRemove: (id: string) => void;
}

export function AttachmentPreview({
  attachments,
  onRemove,
}: AttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="px-3 pt-2.5">
      <AttachmentGroup className="gap-1.5">
        {attachments.map((att) => {
          const isPdf =
            att.mimeType === "application/pdf" || att.name.endsWith(".pdf");
          const isCode =
            att.mimeType?.includes("json") ||
            att.mimeType?.includes("code") ||
            att.name.endsWith(".json") ||
            att.name.endsWith(".js") ||
            att.name.endsWith(".ts") ||
            att.name.endsWith(".py");
          const isSpreadsheet =
            att.mimeType?.includes("spreadsheet") ||
            att.mimeType?.includes("excel") ||
            att.mimeType?.includes("csv") ||
            att.name.endsWith(".xlsx") ||
            att.name.endsWith(".xls") ||
            att.name.endsWith(".csv");

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
                    e.stopPropagation();
                    onRemove(att.id);
                  }}
                  className="size-5 rounded-full bg-background/80 hover:bg-background"
                  title="Remove attachment"
                  aria-label="Remove attachment"
                >
                  <X className="size-3" />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>
          );
        })}
      </AttachmentGroup>
    </div>
  );
}
