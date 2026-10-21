"use client"

import { Button } from "@openbots/ui/components/button"
import { IconDownload, IconFile } from "@tabler/icons-react"
import * as React from "react"

export function DocxViewer({
  source,
  content,
  title,
  onDownload,
}: {
  source?: string
  content?: string
  title: string
  onDownload: () => void
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [htmlContent, setHtmlContent] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true

    async function loadDocx() {
      setLoading(true)
      setError(null)
      setHtmlContent(null)

      try {
        let buffer: ArrayBuffer | null = null

        if (source) {
          const res = await fetch(source)
          if (!res.ok)
            throw new Error(`HTTP ${res.status}: Failed to fetch file`)
          buffer = await res.arrayBuffer()
        } else if (content) {
          if (content.startsWith("UEsDB") || content.length % 4 === 0) {
            try {
              const bin = atob(content)
              const bytes = new Uint8Array(bin.length)
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
              buffer = bytes.buffer
            } catch {
              // Not base64
            }
          }
        }

        if (!buffer) {
          throw new Error("No binary data available to render document preview")
        }

        // 1. Try rendering through mammoth for pristine, crisp HTML typography
        try {
          const mammoth = await import("mammoth")
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
          if (active && result.value && result.value.trim().length > 0) {
            setHtmlContent(result.value)
            setLoading(false)
            return
          }
        } catch (mammothErr) {
          console.warn("Mammoth HTML conversion fallback:", mammothErr)
        }

        // 2. Fallback to docx-preview canvas/DOM renderer if mammoth output is empty
        const { renderAsync } = await import("docx-preview")
        if (!active || !containerRef.current) return
        containerRef.current.innerHTML = ""
        await renderAsync(buffer, containerRef.current, undefined, {
          className: "docx-document",
          inWrapper: false,
          ignoreWidth: true,
          ignoreHeight: true,
        })
        setLoading(false)
      } catch (err: any) {
        if (!active) return
        setError(err?.message || "Failed to parse DOCX document")
        setLoading(false)
      }
    }

    loadDocx()

    return () => {
      active = false
    }
  }, [source, content])

  return (
    <div className="relative size-full overflow-auto bg-sidebar">
      {loading && (
        <div className="flex size-full items-center justify-center py-20">
          <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Rendering document preview...</span>
          </div>
        </div>
      )}

      {error ? (
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <IconFile className="size-10 text-muted-foreground" />
          <h4 className="mt-3 text-sm font-semibold text-foreground">
            {title}
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {error.includes("PK") ||
            error.includes("zip") ||
            error.includes("binary")
              ? "This document contains plain formatted text or custom layout."
              : error}
          </p>
          {content && content.trim().length > 0 && (
            <div className="mt-4 max-h-60 w-full overflow-auto rounded-md bg-muted/30 p-3 text-left font-mono text-xs whitespace-pre-wrap select-text">
              {content}
            </div>
          )}
          <Button size="sm" className="mt-4" onClick={onDownload}>
            <IconDownload className="mr-1.5 size-4" />
            Download File
          </Button>
        </div>
      ) : htmlContent ? (
        <div className="mx-auto max-w-4xl px-6 py-8 select-text sm:px-12 sm:py-10">
          <div
            className="typeset"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
      ) : (
        <div
          ref={containerRef}
          className="mx-auto max-w-4xl bg-transparent p-6 select-text sm:p-10 [&_.docx-document]:bg-transparent [&_.docx-document]:p-0 [&_.docx-wrapper]:bg-transparent [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border/60 [&_td]:p-2.5 [&_th]:border [&_th]:border-border/60 [&_th]:p-2.5"
        />
      )}
    </div>
  )
}
