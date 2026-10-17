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
import * as React from "react"
import {
  Download as IconDownload,
  DocumentText as IconDocumentText,
  CodeFile as IconFileCode,
  FilePdf as IconFileTypePdf,
} from "reicon-react"
import type { MessageAttachment } from "../../utils"
import { formatFileSize } from "../../utils"

interface UserAttachmentsProps {
  images: string[]
  attachments: MessageAttachment[]
}

export function UserAttachments({ images, attachments }: UserAttachmentsProps) {
  return (
    <>
      {images.length > 0 && (
        <AttachmentGroup className="max-w-full justify-end">
          {images.map((imgUrl, idx) => (
            <Attachment key={idx} state="done" orientation="vertical">
              <AttachmentMedia variant="image">
                <img
                  src={imgUrl}
                  alt={`Attachment ${idx + 1}`}
                  loading="lazy"
                />
              </AttachmentMedia>
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
                className="ml-auto"
              >
                <AttachmentMedia variant="icon">
                  {isPdf ? (
                    <IconFileTypePdf className="text-red-500" />
                  ) : isCode ? (
                    <IconFileCode className="text-blue-500" />
                  ) : isSpreadsheet ? (
                    <IconDocumentText className="text-emerald-500" />
                  ) : (
                    <IconDocumentText className="text-primary" />
                  )}
                </AttachmentMedia>
                <AttachmentContent className="max-w-48">
                  <AttachmentTitle title={att.name}>
                    {att.name}
                  </AttachmentTitle>
                  {att.sizeBytes ? (
                    <AttachmentDescription>
                      {formatFileSize(att.sizeBytes)}
                    </AttachmentDescription>
                  ) : null}
                </AttachmentContent>
                <AttachmentActions>
                  <AttachmentAction
                    render={
                      <a
                        href={att.url}
                        download={att.name}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                    title="Download file"
                  >
                    <IconDownload className="size-3.5" />
                  </AttachmentAction>
                </AttachmentActions>
              </Attachment>
            )
          })}
        </AttachmentGroup>
      )}
    </>
  )
}
