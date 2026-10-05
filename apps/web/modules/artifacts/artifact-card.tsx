"use client"

import { Button } from "@openbots/ui/components/button"
import * as React from "react"
import type { ParsedArtifact } from "./parser"
import { HtmlSandbox, MermaidSandbox, SvgSandbox } from "./sandboxes"
import {
  ChartSquare,
  Check,
  Code,
  Copy,
  Maximize,
  VectorSquare,
} from "reicon-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@openbots/ui/components/skeleton"

interface ArtifactCardProps {
  artifact: ParsedArtifact
  onClick: () => void
}

const TYPE_LABEL: Record<string, string> = {
  html: "Interactive UI",
  svg: "SVG",
  mermaid: "Diagram",
}

const THUMB_SIZE: Record<string, { w: number; h: number }> = {
  html: { w: 1280, h: 800 },
  svg: { w: 640, h: 400 },
  mermaid: { w: 640, h: 400 },
}

const MEDIA_CENTER =
  "flex items-center justify-center overflow-auto border-0 bg-background p-6 [&_svg]:max-h-full [&_svg]:max-w-full"

function ArtifactIcon({ type }: { type: ParsedArtifact["type"] }) {
  switch (type) {
    case "svg":
      return <VectorSquare className="size-4" />

    case "mermaid":
      return <ChartSquare className="size-4" />

    default:
      return <Code className="size-4" />
  }
}

/* -------------------------------------------------------------------------- */
/* Preview                                                                     */
/* -------------------------------------------------------------------------- */

function ArtifactPreview({
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
        />
      )

    case "svg":
      return <SvgSandbox svg={artifact.content} className={mediaClassName} />

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

/* -------------------------------------------------------------------------- */
/* Copy                                                                        */
/* -------------------------------------------------------------------------- */

function useCopy(content: string) {
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

  return {
    copied,
    copy,
  }
}

/* -------------------------------------------------------------------------- */
/* Thumbnail frame                                                             */
/* -------------------------------------------------------------------------- */

function useThumbnailFrame() {
  const ref = React.useRef<HTMLDivElement>(null)

  const [width, setWidth] = React.useState(0)
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const element = ref.current

    if (!element) {
      return
    }

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
      {
        rootMargin: "300px",
      }
    )

    intersectionObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
    }
  }, [])

  return {
    ref,
    width,
    visible,
  }
}

/* -------------------------------------------------------------------------- */
/* Inline artifact                                                            */
/* -------------------------------------------------------------------------- */

function InlineArtifact({ artifact, onClick }: ArtifactCardProps) {
  const { copied, copy } = useCopy(artifact.content)
  const isStreaming = artifact.isStreaming

  return (
    <div
      data-artifact-card="true"
      data-artifact-mode="inline"
      role="figure"
      aria-label={artifact.title}
      className={cn(
        "group/artifact relative inline-block w-full max-w-full align-top transition-all"
      )}
    >
      {isStreaming && <Skeleton className="h-100 w-full max-w-100" />}

      {artifact.content.trim().length > 0 ? (
        <ArtifactPreview
          artifact={artifact}
          fitContent
          htmlClassName="border-0 bg-transparent"
          mediaClassName="block w-fit max-w-full border-0 bg-transparent p-0 [&_svg]:block [&_svg]:max-w-full"
        />
      ) : (
        <div className="flex min-h-[100px] w-full items-center justify-center rounded-lg border border-dashed border-primary/25 bg-primary/5 p-4 text-xs text-primary">
          <div className="flex items-center gap-2">
            <span className="size-2 animate-ping rounded-full bg-primary" />
            <span>Generating {artifact.title || "interactive widget"}...</span>
          </div>
        </div>
      )}

      {!isStreaming && (
        <div
          className={cn(
            "absolute top-1 right-1",
            "hidden items-center gap-0.5",
            "rounded-md bg-background/90 p-0.5",
            "shadow-sm backdrop-blur-sm",
            "opacity-0 transition-opacity",
            "group-hover/artifact:opacity-100",
            "group-focus-within/artifact:opacity-100",
            "[@media(hover:none)]:opacity-100"
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={copy}
            title={copied ? "Copied" : "Copy"}
            aria-label={copied ? "Copied" : "Copy"}
            className="size-6"
          >
            {copied ? <Check /> : <Copy />}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onClick}
            title="Open"
            aria-label="Open"
            className="size-6"
          >
            <Maximize />
          </Button>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Card artifact                                                              */
/* -------------------------------------------------------------------------- */

function CardArtifact({ artifact, onClick }: ArtifactCardProps) {
  const { ref, width, visible } = useThumbnailFrame()
  const isStreaming = artifact.isStreaming

  const base = THUMB_SIZE[artifact.type] ?? THUMB_SIZE.html

  const scale = base && width ? width / base.w : 0

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onClick()
    }
  }

  const hasContent = artifact.content.trim().length > 0

  return (
    <div
      data-artifact-card="true"
      role="button"
      tabIndex={0}
      aria-label={`Open ${artifact.title}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group/artifact block w-full max-w-md",
        "cursor-pointer overflow-hidden",
        "rounded-xl border",
        "bg-card text-left",
        "transition-all outline-none",
        isStreaming
          ? "border-primary/35 shadow-xs ring-1 ring-primary/20"
          : "border-border hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <div
        ref={ref}
        className={cn(
          "relative aspect-[16/10] w-full",
          "overflow-hidden border-b border-border",
          "bg-muted/40"
        )}
      >
        {isStreaming && (
          <div className="pointer-events-none absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 rounded-full border border-primary/20 bg-background/85 px-2 py-0.5 text-[10px] font-medium text-primary shadow-xs backdrop-blur-md">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
            <span>Building</span>
          </div>
        )}

        {visible && base && scale > 0 && hasContent ? (
          <div
            className="pointer-events-none absolute top-0 left-0 origin-top-left"
            style={{
              width: base.w,
              height: base.h,
              transform: `scale(${scale})`,
            }}
          >
            <ArtifactPreview
              artifact={artifact}
              htmlClassName="size-full border-0 bg-background"
              mediaClassName={`${MEDIA_CENTER} size-full overflow-hidden`}
            />
          </div>
        ) : isStreaming ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ArtifactIcon type={artifact.type} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">
                {artifact.title ||
                  `Creating ${TYPE_LABEL[artifact.type] ?? artifact.type}...`}
              </p>
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                <span>Streaming live preview...</span>
              </div>
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "absolute inset-0",
            "transition-colors",
            "group-hover/artifact:bg-foreground/[0.03]"
          )}
        />
      </div>

      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div
          className={cn(
            "flex size-7 shrink-0",
            "items-center justify-center",
            "rounded-md text-foreground",
            isStreaming ? "bg-primary/15 text-primary" : "bg-muted"
          )}
        >
          <ArtifactIcon type={artifact.type} />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-[13px]",
              "leading-tight font-medium",
              "text-foreground"
            )}
          >
            {artifact.title}
          </p>

          <div className="mt-0.5 flex items-center gap-1.5">
            <p className="text-[11px] text-muted-foreground">
              {TYPE_LABEL[artifact.type] ?? artifact.type}
            </p>
            {isStreaming && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary">
                • live
              </span>
            )}
          </div>
        </div>

        <Maximize
          className={cn(
            "size-4 shrink-0",
            "text-muted-foreground/50",
            "transition-colors",
            "group-hover/artifact:text-foreground"
          )}
        />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Export                                                                      */
/* -------------------------------------------------------------------------- */

export function ArtifactCard(props: ArtifactCardProps) {
  return props.artifact.mode === "inline" ? (
    <InlineArtifact {...props} />
  ) : (
    <CardArtifact {...props} />
  )
}
