"use client"

import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@openbots/ui/components/attachment"
import * as React from "react"
import {
  DocumentText as IconDocumentText,
  CodeFile as IconFileCode,
  FilePdf as IconFileTypePdf,
} from "reicon-react"
import type { ParsedArtifact } from "@/modules/artifacts/parser"
import type { MessageAttachment } from "../../utils"
import { formatFileSize } from "../../utils"

interface UserAttachmentsProps {
  images: string[]
  attachments: MessageAttachment[]
  onOpenArtifact?: (artifact: ParsedArtifact) => void
}

export function UserAttachments({
  images,
  attachments,
  onOpenArtifact,
}: UserAttachmentsProps) {
  const handleOpenAttachment = React.useCallback(
    (att: MessageAttachment) => {
      if (!onOpenArtifact) return

      const ext = (
        att.name.includes(".") ? att.name.split(".").pop()! : "txt"
      ).toLowerCase()

      const artifact: ParsedArtifact = {
        id: `att-${att.path || att.name}-${Date.now()}`,
        type: "file",
        title: att.name,
        content: "",
        mode: "card",
        isStreaming: false,
        source: att.url,
        fileType: ext,
        size: att.sizeBytes ? String(att.sizeBytes) : undefined,
      }

      onOpenArtifact(artifact)
    },
    [onOpenArtifact]
  )

  const handleOpenImage = React.useCallback(
    (imgUrl: string, idx: number) => {
      if (!onOpenArtifact) return

      const filename = `Image ${idx + 1}`
      const basePart = imgUrl.split("?")[0] || ""
      const ext = basePart.split(".").pop()?.toLowerCase() || "png"

      const artifact: ParsedArtifact = {
        id: `img-${idx}-${Date.now()}`,
        type: "file",
        title: filename,
        content: "",
        mode: "card",
        isStreaming: false,
        source: imgUrl,
        fileType: ext,
      }

      onOpenArtifact(artifact)
    },
    [onOpenArtifact]
  )

  return (
    <>
      {images.length > 0 && (
        <AttachmentGroup className="max-w-full justify-end">
          {images.map((imgUrl, idx) => (
            <Attachment
              key={idx}
              state="done"
              orientation="vertical"
              className={onOpenArtifact ? "cursor-pointer hover:opacity-90" : ""}
            >
              <AttachmentMedia variant="image">
                <img
                  src={imgUrl}
                  alt={`Attachment ${idx + 1}`}
                  loading="lazy"
                />
              </AttachmentMedia>
              {onOpenArtifact && (
                <AttachmentTrigger
                  type="button"
                  onClick={() => handleOpenImage(imgUrl, idx)}
                  aria-label={`Open ${imgUrl}`}
                />
              )}
            </Attachment>
          ))}
        </AttachmentGroup>
      )}

      {attachments.length > 0 && (
        <AttachmentGroup className="max-w-full flex-col">
          {attachments.map((att, idx) => {
            const isPdf =
              att.mimeType === "application/pdf" || att.name.endsWith(".pdf")
            const isCode =
              att.mimeType.includes("json") ||
              att.mimeType.includes("code") ||
              att.name.endsWith(".json") ||
              att.name.endsWith(".js") ||
              att.name.endsWith(".ts") ||
              att.name.endsWith(".py")
            const isSpreadsheet =
              att.mimeType.includes("spreadsheet") ||
              att.mimeType.includes("excel") ||
              att.mimeType.includes("csv") ||
              att.name.endsWith(".xlsx") ||
              att.name.endsWith(".xls") ||
              att.name.endsWith(".csv")

            return (
              <Attachment
                key={att.path || idx}
                state="done"
                orientation="horizontal"
                className="ml-auto cursor-pointer transition-colors hover:bg-muted/50"
              >
                <AttachmentMedia variant="icon">
                  {isPdf ? (
                    <IconFileTypePdf />
                  ) : isCode ? (
                    <IconFileCode />
                  ) : isSpreadsheet ? (
                    <IconDocumentText />
                  ) : (
                    <IconDocumentText />
                  )}
                </AttachmentMedia>
                <AttachmentContent className="max-w-48">
                  <AttachmentTitle title={att.name}>{att.name}</AttachmentTitle>
                  {att.sizeBytes ? (
                    <AttachmentDescription>
                      {formatFileSize(att.sizeBytes)}
                    </AttachmentDescription>
                  ) : null}
                </AttachmentContent>
                {onOpenArtifact && (
                  <AttachmentTrigger
                    type="button"
                    onClick={() => handleOpenAttachment(att)}
                    aria-label={`Open ${att.name}`}
                  />
                )}
              </Attachment>
            )
          })}
        </AttachmentGroup>
      )}
    </>
  )
}
