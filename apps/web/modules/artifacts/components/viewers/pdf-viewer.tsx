"use client"

import { Button } from "@openbots/ui/components/button"
import { Spinner } from "@openbots/ui/components/spinner"
import {
  IconChevronLeft,
  IconChevronRight,
  IconFileTypePdf,
  IconMaximize,
  IconMinimize,
  IconPrinter,
  IconZoomIn,
  IconZoomOut,
  IconZoomReset,
} from "@tabler/icons-react"
import * as React from "react"
import { cn } from "@/lib/utils"

interface PdfViewerProps {
  source?: string
  content?: string
  title: string
  onDownload?: () => void
}

export function PdfViewer({ source, content, title }: PdfViewerProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [numPages, setNumPages] = React.useState<number>(0)
  const [currentPage, setCurrentPage] = React.useState<number>(1)
  const [zoom, setZoom] = React.useState<number>(100)
  const [fitWidth, setFitWidth] = React.useState<boolean>(false)

  // Store pdf document instance and page references
  const pdfDocRef = React.useRef<any>(null)
  const canvasRefs = React.useRef<Map<number, HTMLCanvasElement>>(new Map())
  const renderedPagesRef = React.useRef<Set<number>>(new Set())

  // Load PDF document using pdfjs-dist
  React.useEffect(() => {
    let active = true

    async function loadPdf() {
      setLoading(true)
      setError(null)
      renderedPagesRef.current.clear()

      try {
        const pdfjsLib = await import("pdfjs-dist")
        // Setup worker URL
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
            const bin = atob(base64.replace(/\s/g, ""))
            const bytes = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
            dataSrc = { data: bytes }
          } else {
            try {
              const bin = atob(content.replace(/\s/g, ""))
              const bytes = new Uint8Array(bin.length)
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
              dataSrc = { data: bytes }
            } catch {
              throw new Error("Invalid base64 PDF stream data")
            }
          }
        }

        if (!dataSrc) throw new Error("No PDF source or binary stream provided")

        const loadingTask = pdfjsLib.getDocument(dataSrc)
        const pdf = await loadingTask.promise

        if (!active) return

        pdfDocRef.current = pdf
        setNumPages(pdf.numPages)
        setCurrentPage(1)
        setLoading(false)
      } catch (err: any) {
        if (!active) return
        setError(err?.message || "Failed to load and render PDF")
        setLoading(false)
      }
    }

    loadPdf()

    return () => {
      active = false
      pdfDocRef.current = null
      renderedPagesRef.current.clear()
    }
  }, [source, content])

  // Render individual page on canvas with true aspect ratio
  const renderPage = React.useCallback(
    async (pageNum: number) => {
      const pdf = pdfDocRef.current
      if (!pdf) return

      const canvas = canvasRefs.current.get(pageNum)
      if (!canvas) return

      try {
        const page = await pdf.getPage(pageNum)
        const dpr =
          typeof window !== "undefined"
            ? Math.max(window.devicePixelRatio || 1, 2)
            : 2

        // Calculate display dimensions based on standard container width or zoom
        const containerWidth = scrollContainerRef.current?.clientWidth || 800
        const unscaledViewport = page.getViewport({ scale: 1.0 })
        const aspectRatio = unscaledViewport.height / unscaledViewport.width

        // Standard reading width is ~720px on desktop
        const baseWidth = fitWidth
          ? Math.min(containerWidth - 48, 960)
          : Math.min(containerWidth - 64, 720) * (zoom / 100)

        const displayWidth = Math.max(300, Math.floor(baseWidth))
        const displayHeight = Math.floor(displayWidth * aspectRatio)

        // Viewport scaled for crisp retina/high-DPI canvas backing
        const scale = displayWidth / unscaledViewport.width
        const viewport = page.getViewport({ scale: scale * dpr })

        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)

        // Strict explicit CSS pixel styles prevent ANY distortion or stretching
        canvas.style.width = `${displayWidth}px`
        canvas.style.height = `${displayHeight}px`
        canvas.style.maxWidth = "100%"

        const context = canvas.getContext("2d", { alpha: false })
        if (!context) return

        context.fillStyle = "#ffffff"
        context.fillRect(0, 0, canvas.width, canvas.height)

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise

        renderedPagesRef.current.add(pageNum)
      } catch (err) {
        console.warn(`Failed rendering PDF page ${pageNum}:`, err)
      }
    },
    [zoom, fitWidth]
  )

  // Re-render visible pages when zoom or fitWidth changes
  React.useEffect(() => {
    if (!pdfDocRef.current || numPages === 0) return
    for (let i = 1; i <= numPages; i++) {
      renderPage(i)
    }
  }, [numPages, renderPage])

  // Track active page on scroll
  const handleScroll = () => {
    if (!scrollContainerRef.current) return
    const containerTop = scrollContainerRef.current.scrollTop
    const containerHeight = scrollContainerRef.current.clientHeight

    let activePage = 1
    canvasRefs.current.forEach((canvas, pageNum) => {
      const rect = canvas.getBoundingClientRect()
      const parentRect = scrollContainerRef.current?.getBoundingClientRect()
      if (parentRect && rect.top - parentRect.top < containerHeight / 2) {
        activePage = pageNum
      }
    })
    setCurrentPage(activePage)
  }

  const scrollToPage = (pageNum: number) => {
    const target = canvasRefs.current.get(pageNum)
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
      setCurrentPage(pageNum)
    }
  }

  const handleZoomIn = () => setZoom((z) => Math.min(z + 10, 150))
  const handleZoomOut = () => setZoom((z) => Math.max(z - 10, 70))
  const handleResetZoom = () => {
    setZoom(100)
    setFitWidth(false)
  }

  const handlePrint = () => {
    if (source) {
      const printWindow = window.open(source, "_blank")
      printWindow?.print()
      return
    }

    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const images: string[] = []
    canvasRefs.current.forEach((canvas) => {
      try {
        images.push(canvas.toDataURL("image/png"))
      } catch {}
    })

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title || "PDF Document"}</title>
          <style>
            @page { margin: 0; size: auto; }
            body { margin: 0; padding: 0; background: #fff; }
            img { display: block; width: 100%; height: auto; page-break-after: always; break-after: page; }
          </style>
        </head>
        <body>
          ${images.map((img) => `<img src="${img}" />`).join("")}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 400)
  }

  return (
    <div className="relative flex size-full flex-col overflow-hidden bg-muted/20 dark:bg-zinc-950">
      {/* Claude-style Minimal Sticky PDF Viewer Toolbar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/70 bg-background/95 px-3 py-1.5 backdrop-blur-xs sm:px-4">
        {/* Left: Document type badge & Page navigation */}
        <div className="flex min-w-0 items-center gap-2">
          {numPages > 0 && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => scrollToPage(Math.max(currentPage - 1, 1))}
                disabled={currentPage <= 1}
                title="Previous page"
                aria-label="Previous page"
              >
                <IconChevronLeft className="size-3.5" />
              </Button>

              <span className="text-xs font-medium text-foreground">
                <span className="font-semibold">{currentPage}</span>
                <span className="text-muted-foreground/60"> / </span>
                <span className="text-muted-foreground">{numPages}</span>
              </span>

              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() =>
                  scrollToPage(Math.min(currentPage + 1, numPages))
                }
                disabled={currentPage >= numPages}
                title="Next page"
                aria-label="Next page"
              >
                <IconChevronRight className="size-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Right: Controls (Zoom, Fit, Print) */}
        <div className="flex items-center gap-1">
          <div className="hidden items-center gap-0.5 rounded-lg border border-border/60 bg-muted/30 p-0.5 sm:flex">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={handleZoomOut}
              disabled={zoom <= 70}
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
              disabled={zoom >= 150}
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
            title="Print PDF"
            aria-label="Print PDF"
          >
            <IconPrinter className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Main PDF Scroll Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="relative min-h-0 flex-1 overflow-auto p-4 sm:p-8"
      >
        {loading && (
          <div className="flex size-full flex-col items-center justify-center py-24">
            <Spinner className="size-6 text-primary" />
            <span className="mt-3 text-xs font-medium text-muted-foreground">
              Rendering PDF preview...
            </span>
          </div>
        )}

        {error ? (
          <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-border/80 bg-background p-8 text-center shadow-xs">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
              <IconFileTypePdf className="size-7" />
            </div>
            <h4 className="mt-4 text-base font-semibold text-foreground">
              {title}
            </h4>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {error.includes("Invalid PDF structure") ||
              error.includes("Missing PDF")
                ? "Unable to parse PDF data directly."
                : error}
            </p>
          </div>
        ) : (
          /* Multi-page continuous view with preserved proportions */
          <div className="mx-auto flex flex-col items-center gap-6 sm:gap-8">
            {Array.from({ length: numPages }, (_, index) => {
              const pageNumber = index + 1
              return (
                <div
                  key={pageNumber}
                  id={`pdf-page-${pageNumber}`}
                  className="group/page relative flex flex-col items-center"
                >
                  {/* Crisp white paper page with subtle shadow and border */}
                  <div className="overflow-hidden rounded-md border border-border/60 bg-white shadow-xs transition-shadow duration-200 hover:shadow-md dark:border-border/40">
                    <canvas
                      ref={(el) => {
                        if (el) {
                          canvasRefs.current.set(pageNumber, el)
                          if (!renderedPagesRef.current.has(pageNumber)) {
                            renderPage(pageNumber)
                          }
                        } else {
                          canvasRefs.current.delete(pageNumber)
                        }
                      }}
                      className="block"
                    />
                  </div>

                  {/* Page indicator pill */}
                  <span className="mt-2 font-mono text-[11px] text-muted-foreground/70 select-none">
                    Page {pageNumber} of {numPages}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
