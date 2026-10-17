"use client"

import * as React from "react"
import {
  ChartSquare,
  Code,
  CodeFile,
  DocumentText,
  FilePdf,
  VectorSquare,
} from "reicon-react"
import type { ParsedArtifact } from "../parser"
import { HtmlSandbox, MermaidSandbox, SvgSandbox } from "../sandboxes"

export interface ArtifactCardProps {
  artifact: ParsedArtifact
  onClick: () => void
}

export const TYPE_LABEL: Record<string, string> = {
  html: "Interactive UI",
  svg: "SVG",
  mermaid: "Diagram",
  file: "File",
}

export const THUMB_SIZE: Record<string, { w: number; h: number }> = {
  html: { w: 1280, h: 800 },
  svg: { w: 640, h: 400 },
  mermaid: { w: 640, h: 400 },
}

export const MEDIA_CENTER =
  "flex items-center justify-center overflow-auto border-0 bg-background p-6 [&_svg]:max-h-full [&_svg]:max-w-full"

export function ArtifactIcon({
  type,
  fileType,
}: {
  type: ParsedArtifact["type"]
  fileType?: string
}) {
  if (type === "file") {
    const ext = fileType?.toLowerCase()
    if (ext === "pdf") {
      return <FilePdf className="size-4" />
    }
    if (ext === "xlsx" || ext === "xls" || ext === "csv" || ext === "sheet") {
      return <DocumentText className="size-4" />
    }
    if (
      ext === "json" ||
      ext === "js" ||
      ext === "ts" ||
      ext === "py" ||
      ext === "code"
    ) {
      return <CodeFile className="size-4" />
    }
    return <DocumentText className="size-4" />
  }

  switch (type) {
    case "svg":
      return <VectorSquare className="size-4" />

    case "mermaid":
      return <ChartSquare className="size-4" />

    default:
      return <Code className="size-4" />
  }
}

export function ArtifactPreview({
  artifact,
  htmlClassName,
  mediaClassName,
  fitContent = false,
}: {
  artifact: ParsedArtifact
  htmlClassName?: string
  mediaClassName?: string
  fitContent?: boolean
}) {
  switch (artifact.type) {
    case "html":
      return (
        <HtmlSandbox
          code={artifact.content}
          className={htmlClassName}
          fitContent={fitContent}
          isStreaming={artifact.isStreaming}
        />
      )

    case "svg":
      return (
        <SvgSandbox
          svg={artifact.content}
          className={mediaClassName}
          isStreaming={artifact.isStreaming}
        />
      )

    case "mermaid":
      return (
        <MermaidSandbox
          code={artifact.content}
          className={mediaClassName}
          isStreaming={artifact.isStreaming}
        />
      )

    default:
      return null
  }
}

export function useCopy(content: string) {
  const [copied, setCopied] = React.useState(false)
  const timeout = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (timeout.current) {
        clearTimeout(timeout.current)
      }
    }
  }, [])

  const copy = React.useCallback(
    async (event: React.MouseEvent) => {
      event.stopPropagation()

      try {
        await navigator.clipboard.writeText(content)
        setCopied(true)

        if (timeout.current) {
          clearTimeout(timeout.current)
        }

        timeout.current = setTimeout(() => {
          setCopied(false)
        }, 2000)
      } catch (error) {
        console.error("Failed to copy artifact code:", error)
      }
    },
    [content]
  )

  return { copied, copy }
}

export function useThumbnailFrame() {
  const ref = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(0)
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const element = ref.current
    if (!element) return

    const resizeObserver = new ResizeObserver(([entry]) => {
      setWidth(entry?.contentRect.width ?? 0)
    })
    resizeObserver.observe(element)

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          intersectionObserver.disconnect()
        }
      },
      { rootMargin: "300px" }
    )
    intersectionObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
    }
  }, [])

  return { ref, width, visible }
}
