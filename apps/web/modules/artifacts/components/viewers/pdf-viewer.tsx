"use client"

import { Button, buttonVariants } from "@openbots/ui/components/button"
import { IconDownload, IconFileTypePdf } from "@tabler/icons-react"
import * as React from "react"
import { cn } from "@/lib/utils"
import { PdfCanvasFallback } from "./pdf-canvas-fallback"

export function PdfViewer({
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
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [useCanvasFallback, setUseCanvasFallback] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true
    let createdUrl: string | null = null

    async function preparePdfUrl() {
      setLoading(true)
      setError(null)

      try {
        if (source) {
          if (active) {
            setBlobUrl(source)
            setLoading(false)
          }
          return
        }

        if (content) {
          let bytes: Uint8Array | null = null
          if (content.startsWith("data:application/pdf;base64,")) {
            const base64 = content.split(",")[1] || ""
            const bin = atob(base64)
            bytes = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
          } else if (content.startsWith("data:")) {
            const base64 = content.split(",")[1] || ""
            const bin = atob(base64)
            bytes = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
          } else {
            try {
              const bin = atob(content)
              bytes = new Uint8Array(bin.length)
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
            } catch {
              // Not valid base64
            }
          }

          if (bytes) {
            const blob = new Blob([bytes.buffer as ArrayBuffer], {
              type: "application/pdf",
            })
            createdUrl = URL.createObjectURL(blob)
            if (active) {
              setBlobUrl(createdUrl)
              setLoading(false)
            }
            return
          }
        }

        throw new Error("Unable to load PDF source")
      } catch (err: any) {
        if (!active) return
        setError(err?.message || "Failed to prepare PDF")
        setLoading(false)
      }
    }

    preparePdfUrl()

    return () => {
      active = false
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl)
      }
    }
  }, [source, content])

  if (loading) {
    return (
      <div className="flex size-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Loading PDF document...</span>
        </div>
      </div>
    )
  }

  if (error || (!blobUrl && !useCanvasFallback)) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center p-6 text-center">
        <IconFileTypePdf className="size-10 text-red-500 dark:text-red-400" />
        <h4 className="mt-3 text-sm font-semibold text-foreground">{title}</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          {error || "Unable to display PDF preview directly."}
        </p>
        <div className="mt-5 grid gap-2">
          <Button size="sm" className="w-full gap-1.5" onClick={onDownload}>
            <IconDownload className="size-3.5" />
            Download PDF
          </Button>
          {source && (
            <a
              href={source}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "w-full"
              )}
            >
              Open in tab
            </a>
          )}
        </div>
      </div>
    )
  }

  if (useCanvasFallback) {
    return (
      <PdfCanvasFallback
        source={source}
        content={content}
        title={title}
        onDownload={onDownload}
      />
    )
  }

  return (
    <div className="relative size-full bg-muted/20">
      <object
        data={`${blobUrl}#toolbar=1&navpanes=0`}
        type="application/pdf"
        className="size-full border-0"
      >
        <PdfCanvasFallback
          source={source}
          content={content}
          title={title}
          onDownload={onDownload}
        />
      </object>
    </div>
  )
}
