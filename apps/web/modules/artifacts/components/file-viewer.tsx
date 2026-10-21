"use client"

import { Button, buttonVariants } from "@openbots/ui/components/button"
import {
  IconDownload,
  IconFile,
  IconFileSpreadsheet,
  IconFileText,
  IconFileTypePdf,
} from "@tabler/icons-react"
import * as React from "react"
import { cn } from "@/lib/utils"
import type { ParsedArtifact } from "../parser"
import { DocxViewer } from "./viewers/docx-viewer"
import { HtmlDocumentViewer } from "./viewers/html-viewer"
import { MarkdownDocumentViewer } from "./viewers/markdown-viewer"
import { PdfViewer } from "./viewers/pdf-viewer"
import { SpreadsheetViewer } from "./viewers/spreadsheet-viewer"

export function FileViewer({
  artifact,
  onDownload,
}: {
  artifact: ParsedArtifact
  onDownload: () => void
}) {
  const ext = (
    artifact.fileType ||
    artifact.source?.split(".").pop() ||
    artifact.title?.split(".").pop() ||
    "file"
  ).toLowerCase()

  const isPdf = ext === "pdf"
  const isImage = ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)
  const isSpreadsheet = ["xlsx", "xls", "csv"].includes(ext)

  const formattedSize = React.useMemo(() => {
    if (!artifact.size) return null
    const num = Number(artifact.size)
    if (isNaN(num)) return artifact.size
    if (num < 1024) return `${num} B`
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`
    return `${(num / (1024 * 1024)).toFixed(1)} MB`
  }, [artifact.size])

  // PDF Preview
  if (isPdf && (artifact.source || artifact.content)) {
    return (
      <PdfViewer
        source={artifact.source}
        content={artifact.content}
        title={artifact.title}
        onDownload={onDownload}
      />
    )
  }

  // Image Preview
  if (isImage && (artifact.source || artifact.content)) {
    const imgSrc =
      artifact.source ||
      (artifact.content.startsWith("data:")
        ? artifact.content
        : `data:image/${ext};base64,${artifact.content}`)
    return (
      <div className="flex size-full items-center justify-center overflow-auto bg-sidebar p-6">
        <img
          src={imgSrc}
          alt={artifact.title}
          className="max-h-full max-w-full rounded-md border border-border object-contain shadow-sm"
        />
      </div>
    )
  }

  // DOCX / Word Document Preview
  if (
    (ext === "docx" || ext === "doc") &&
    (artifact.source || artifact.content)
  ) {
    return (
      <DocxViewer
        source={artifact.source}
        content={artifact.content}
        title={artifact.title}
        onDownload={onDownload}
      />
    )
  }

  // Spreadsheet (XLSX, XLS, CSV) Preview
  if (isSpreadsheet && (artifact.source || artifact.content)) {
    return (
      <SpreadsheetViewer
        source={artifact.source}
        content={artifact.content}
        ext={ext}
        onDownload={onDownload}
      />
    )
  }

  // HTML Document Preview
  if (
    (ext === "html" || ext === "htm") &&
    (artifact.source || artifact.content)
  ) {
    return (
      <HtmlDocumentViewer
        source={artifact.source}
        content={artifact.content}
        title={artifact.title}
        ext={ext}
        onDownload={onDownload}
      />
    )
  }

  // Text & Markdown Document Preview (md, txt, json, csv, etc. via content or source fetch)
  const isTextDoc = [
    "md",
    "markdown",
    "txt",
    "text",
    "json",
    "log",
    "yaml",
    "yml",
    "xml",
    "toml",
  ].includes(ext)

  if (isTextDoc || (artifact.content && artifact.content.trim().length > 0)) {
    return (
      <MarkdownDocumentViewer
        source={artifact.source}
        content={artifact.content}
        title={artifact.title}
        ext={ext}
        onDownload={onDownload}
      />
    )
  }

  // Generic & Document Preview / Download Screen
  return (
    <div className="flex size-full flex-col items-center justify-center bg-sidebar p-8 text-center">
      <div className="flex max-w-md flex-col items-center p-8 shadow-sm">
        <div className="flex size-16 items-center justify-center rounded-2xl border border-border/80 bg-muted/60 text-primary shadow-xs">
          {isPdf ? (
            <IconFileTypePdf className="size-8 text-red-500 dark:text-red-400" />
          ) : isSpreadsheet ? (
            <IconFileSpreadsheet className="size-8 text-emerald-600 dark:text-emerald-400" />
          ) : ext === "txt" || ext === "md" || ext === "json" ? (
            <IconFileText className="size-8 text-blue-500 dark:text-blue-400" />
          ) : (
            <IconFile className="size-8 text-primary" />
          )}
        </div>

        <h3 className="mt-4 line-clamp-2 text-lg font-semibold tracking-tight text-foreground">
          {artifact.title}
        </h3>

        <div className="mt-1.5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono font-semibold tracking-wide text-foreground/80 uppercase">
            {ext}
          </span>
          {formattedSize && (
            <>
              <span>·</span>
              <span>{formattedSize}</span>
            </>
          )}
          {artifact.createdAt && (
            <>
              <span>·</span>
              <span>{new Date(artifact.createdAt).toLocaleDateString()}</span>
            </>
          )}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          This file was generated and safely stored. Click below to download or
          view it in your preferred application.
        </p>

        <div className="mt-6 flex w-full flex-col gap-2.5">
          <Button onClick={onDownload}>
            <IconDownload className="size-4" />
            Download {ext.toUpperCase()}
          </Button>

          {artifact.source && (
            <a
              href={artifact.source}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Open source link in new tab
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
