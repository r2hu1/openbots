"use client"

import * as React from "react"

export function PdfCanvasFallback({
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
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true

    async function renderPdf() {
      if (!containerRef.current) return
      setLoading(true)
      setError(null)

      try {
        const pdfjsLib = await import("pdfjs-dist")
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

        let dataSrc: any = null
        if (source) {
          const res = await fetch(source)
          if (!res.ok)
            throw new Error(`HTTP ${res.status}: Failed to fetch PDF`)
          const ab = await res.arrayBuffer()
          dataSrc = { data: new Uint8Array(ab) }
        } else if (content) {
          if (content.startsWith("data:")) {
            const base64 = content.split(",")[1] || ""
            const bin = atob(base64)
            const bytes = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
            dataSrc = { data: bytes }
          } else {
            const bin = atob(content)
            const bytes = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
            dataSrc = { data: bytes }
          }
        }

        if (!dataSrc) throw new Error("No PDF source provided")

        const loadingTask = pdfjsLib.getDocument(dataSrc)
        const pdf = await loadingTask.promise
        if (!active || !containerRef.current) return

        containerRef.current.innerHTML = ""

        // Render with ultra crisp scale for vector-like clarity
        const dpr =
          typeof window !== "undefined"
            ? Math.max(window.devicePixelRatio || 1, 2)
            : 2
        const baseScale = 2.0

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (!active || !containerRef.current) return
          const page = await pdf.getPage(pageNum)
          const viewport = page.getViewport({ scale: baseScale })
          const scaledViewport = page.getViewport({ scale: baseScale * dpr })

          const pageWrapper = document.createElement("div")
          pageWrapper.className =
            "mb-8 flex flex-col items-center bg-transparent p-0"

          const canvas = document.createElement("canvas")
          const context = canvas.getContext("2d", { alpha: false })
          canvas.height = Math.floor(scaledViewport.height)
          canvas.width = Math.floor(scaledViewport.width)
          canvas.style.width = `${Math.floor(viewport.width)}px`
          canvas.style.height = `${Math.floor(viewport.height)}px`
          canvas.className = "max-w-full h-auto rounded-sm shadow-md bg-white"

          pageWrapper.appendChild(canvas)

          const pageLabel = document.createElement("div")
          pageLabel.className =
            "mt-3 text-[11px] text-muted-foreground/70 font-mono select-none"
          pageLabel.innerText = `${pageNum} / ${pdf.numPages}`
          pageWrapper.appendChild(pageLabel)

          containerRef.current.appendChild(pageWrapper)

          if (context) {
            await page.render({
              canvasContext: context,
              canvas,
              viewport: scaledViewport,
            }).promise
          }
        }

        setLoading(false)
      } catch (err: any) {
        if (!active) return
        setError(err?.message || "Failed to render PDF")
        setLoading(false)
      }
    }

    renderPdf()

    return () => {
      active = false
    }
  }, [source, content])

  return (
    <div className="relative size-full overflow-auto bg-muted/10 p-4 sm:p-10">
      {loading && (
        <div className="flex size-full items-center justify-center py-20">
          <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Rendering crisp PDF preview...</span>
          </div>
        </div>
      )}

      {error ? (
        <div className="mx-auto flex max-w-md flex-col items-center justify-center p-6 text-center shadow-xs">
          <h4 className="mt-3 text-sm font-semibold text-foreground">
            {title}
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {error.includes("Invalid PDF structure") ||
            error.includes("Missing PDF")
              ? "Unable to parse PDF data directly. You can download the file below."
              : error}
          </p>
          <div className="mt-5 flex w-full gap-2">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              onClick={onDownload}
            >
              Download PDF
            </button>
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="mx-auto flex max-w-3xl flex-col items-center"
        />
      )}
    </div>
  )
}
