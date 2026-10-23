"use client"

import { Button } from "@openbots/ui/components/button"
import { Spinner } from "@openbots/ui/components/spinner"
import {
  IconFileText,
  IconMaximize,
  IconMinimize,
  IconPrinter,
  IconZoomIn,
  IconZoomOut,
  IconZoomReset,
} from "@tabler/icons-react"
import * as React from "react"
import { cn } from "@/lib/utils"

interface DocxViewerProps {
  source?: string
  content?: string
  title: string
  onDownload?: () => void
}

export function DocxViewer({ source, content, title }: DocxViewerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const docBodyRef = React.useRef<HTMLDivElement>(null)
  const [htmlContent, setHtmlContent] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [zoom, setZoom] = React.useState<number>(100)
  const [fitWidth, setFitWidth] = React.useState(false)

  // Load and convert DOCX
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
              const bin = atob(content.replace(/\s/g, ""))
              const bytes = new Uint8Array(bin.length)
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
              buffer = bytes.buffer
            } catch {}
          }
        }

        if (!buffer) {
          throw new Error("No binary data available to render document preview")
        }

        // 1. Try mammoth first for pristine, semantic HTML typography
        try {
          const mammoth = await import("mammoth")
          const result = await mammoth.convertToHtml(
            { arrayBuffer: buffer },
            {
              styleMap: [
                "p[style-name='Title'] => h1.doc-title:fresh",
                "p[style-name='Subtitle'] => p.doc-subtitle:fresh",
                "p[style-name='Heading 1'] => h1:fresh",
                "p[style-name='Heading 2'] => h2:fresh",
                "p[style-name='Heading 3'] => h3:fresh",
                "table => table.docx-table:fresh",
              ],
            }
          )

          if (active && result.value && result.value.trim().length > 0) {
            setHtmlContent(result.value)
            setLoading(false)
            return
          }
        } catch (mammothErr) {
          console.warn("Mammoth HTML conversion fallback:", mammothErr)
        }

        // 2. Fallback to docx-preview if mammoth fails or produces empty output
        const { renderAsync } = await import("docx-preview")
        if (!active || !containerRef.current) return
        containerRef.current.innerHTML = ""
        await renderAsync(buffer, containerRef.current, undefined, {
          className: "docx-document",
          inWrapper: false,
          ignoreWidth: true,
          ignoreHeight: true,
          renderHeaders: true,
          renderFooters: true,
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

  // Word & character stats calculation
  const stats = React.useMemo(() => {
    if (!htmlContent) return null
    const textOnly = htmlContent
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    const words = textOnly ? textOnly.split(/\s+/).length : 0
    const readingTime = Math.max(1, Math.ceil(words / 220))
    return { words, readingTime }
  }, [htmlContent])

  const handleZoomIn = () => setZoom((z) => Math.min(z + 10, 140))
  const handleZoomOut = () => setZoom((z) => Math.max(z - 10, 80))
  const handleResetZoom = () => {
    setZoom(100)
    setFitWidth(false)
  }

  const handlePrint = () => {
    if (!docBodyRef.current) return
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const htmlToPrint = docBodyRef.current.innerHTML
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title || "Document"}</title>
          <style>
            @page { margin: 20mm 18mm; size: A4 portrait; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Georgia, serif;
              color: #111827;
              line-height: 1.7;
              font-size: 11pt;
              margin: 0;
              padding: 0;
            }
            h1, h2, h3 { color: #000000; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
            h1 { font-size: 20pt; border-bottom: 1.5pt solid #E5E7EB; padding-bottom: 6pt; margin-bottom: 16pt; }
            h2 { font-size: 15pt; margin-top: 18pt; margin-bottom: 8pt; }
            h3 { font-size: 12.5pt; margin-top: 14pt; margin-bottom: 6pt; }
            p { margin: 0 0 10pt 0; }
            table { width: 100%; border-collapse: collapse; margin: 14pt 0; font-size: 10pt; }
            th, td { border: 1pt solid #D1D5DB; padding: 6pt 10pt; text-align: left; }
            th { background: #F3F4F6; font-weight: 600; }
            img { max-width: 100%; height: auto; }
            blockquote { border-left: 3pt solid #3B82F6; margin: 12pt 0; padding-left: 12pt; color: #4B5563; font-style: italic; }
          </style>
        </head>
        <body>
          <div>${htmlToPrint}</div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 300)
  }

  return (
    <div className="relative flex size-full flex-col overflow-hidden bg-muted/20 dark:bg-zinc-950">
      {/* Claude-style Minimal Sticky Viewer Toolbar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/70 bg-background/95 px-3 py-1.5 backdrop-blur-xs sm:px-4">
        {/* Left: Document info & badge */}
        <div className="flex min-w-0 items-center gap-2">
          {stats && (
            <span className="inline-block text-xs text-muted-foreground/80">
              {stats.words.toLocaleString()} words · {stats.readingTime} min
              read
            </span>
          )}
        </div>

        {/* Right: Controls (Zoom, Fit, Copy, Print, Download) */}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/30 p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={handleZoomOut}
              disabled={zoom <= 80}
              title="Zoom out"
              aria-label="Zoom out"
            >
              <IconZoomOut className="size-3.5" />
            </Button>

            <span className="w-11 text-center font-mono text-[11px] font-medium text-foreground">
              {zoom}%
            </span>

            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={handleZoomIn}
              disabled={zoom >= 140}
              title="Zoom in"
              aria-label="Zoom in"
            >
              <IconZoomIn className="size-3.5" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={handleResetZoom}
              title="Reset zoom"
              aria-label="Reset zoom"
            >
              <IconZoomReset className="size-3.5" />
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setFitWidth(!fitWidth)}
            title={fitWidth ? "Standard page view" : "Fit to width"}
            aria-label="Toggle fit width"
            className={cn(fitWidth && "bg-muted text-foreground")}
          >
            {fitWidth ? (
              <IconMinimize className="size-3.5" />
            ) : (
              <IconMaximize className="size-3.5" />
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handlePrint}
            title="Print document"
            aria-label="Print document"
          >
            <IconPrinter className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Document Scroll Area */}
      <div className="relative min-h-0 flex-1 overflow-auto p-4 sm:p-8">
        {loading && (
          <div className="flex size-full flex-col items-center justify-center py-24">
            <Spinner className="size-6 text-primary" />
            <span className="mt-3 text-xs font-medium text-muted-foreground">
              Preparing document preview...
            </span>
          </div>
        )}

        {error ? (
          <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-border/80 bg-background p-8 text-center shadow-xs">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
              <IconFileText className="size-7" />
            </div>
            <h4 className="mt-4 text-base font-semibold text-foreground">
              {title}
            </h4>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {error.includes("PK") ||
              error.includes("zip") ||
              error.includes("binary")
                ? "This document contains custom binary formatting or macros."
                : error}
            </p>
            {content && content.trim().length > 0 && (
              <div className="mt-4 max-h-56 w-full overflow-auto rounded-lg bg-muted/40 p-3 text-left font-mono text-[11px] whitespace-pre-wrap select-text">
                {content}
              </div>
            )}
          </div>
        ) : (
          /* Claude-style Page Container: naturally proportioned single page sheet with max-width */
          <div
            className="mx-auto flex justify-center transition-all duration-150"
            style={{
              width: "100%",
              maxWidth: fitWidth ? "900px" : "720px",
            }}
          >
            <article
              ref={docBodyRef}
              style={{
                fontSize: `${zoom}%`,
              }}
              className={cn(
                "w-full rounded-md border border-border/70 bg-white text-zinc-900 transition-shadow select-text",
                "shadow-xs hover:shadow-md dark:border-border/40 dark:bg-zinc-900 dark:text-zinc-100",
                "p-6 sm:p-12",
                "typeset",
                "[&_h1]:border-b [&_h1]:border-border/60 [&_h1]:pb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-foreground",
                "[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground",
                "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-foreground",
                "[&_p]:leading-relaxed [&_p]:text-foreground/90",
                "[&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
                "[&_td]:border [&_td]:border-border/70 [&_td]:p-3 [&_td]:align-top",
                "[&_th]:border [&_th]:border-border/70 [&_th]:bg-muted/40 [&_th]:p-3 [&_th]:text-left [&_th]:font-semibold",
                "[&_blockquote]:rounded-r-md [&_blockquote]:border-l-3 [&_blockquote]:border-primary/60 [&_blockquote]:bg-muted/20 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:italic",
                "[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6",
                "[&_li]:mb-1.5 [&_li]:leading-relaxed",
                "[&_img]:my-6 [&_img]:max-w-full [&_img]:rounded-md [&_img]:border [&_img]:border-border/60 [&_img]:shadow-xs"
              )}
            >
              {htmlContent ? (
                <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
              ) : (
                <div
                  ref={containerRef}
                  className="[&_.docx-document]:bg-transparent [&_.docx-document]:p-0 [&_.docx-wrapper]:bg-transparent"
                />
              )}
            </article>
          </div>
        )}
      </div>
    </div>
  )
}
