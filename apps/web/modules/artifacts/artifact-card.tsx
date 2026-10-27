"use client"

import { Button } from "@openbots/ui/components/button"
import { Spinner } from "@openbots/ui/components/spinner"
import * as React from "react"
import { cn } from "@/lib/utils"
import { useArtifact } from "./artifact-context"
import {
  type ArtifactCardProps,
  ArtifactIcon,
  TYPE_LABEL,
} from "./components/artifact-card-common"
import { InlineArtifact } from "./components/inline-artifact"

export * from "./artifact-context"
export {
  type ArtifactCardProps,
  ArtifactIcon,
  ArtifactPreview,
  useCopy,
  useThumbnailFrame,
} from "./components/artifact-card-common"

export function SharedArtifactCard({
  artifact,
  onClick,
  className,
}: ArtifactCardProps & { className?: string }) {
  const artifactCtx = useArtifact()
  const isStreaming = artifact.isStreaming
  const isOpen = artifactCtx?.isOpen(artifact) ?? false
  const isFile = artifact.type === "file"

  const title =
    artifact.title ||
    (isFile
      ? "Untitled File"
      : `Untitled ${TYPE_LABEL[artifact.type] ?? artifact.type}`)

  const subtitle = React.useMemo(() => {
    if (isFile) {
      return (
        artifact.fileType ||
        artifact.source?.split(".").pop() ||
        artifact.title?.split(".").pop() ||
        "file"
      ).toUpperCase()
    }
    return (TYPE_LABEL[artifact.type] ?? artifact.type).toUpperCase()
  }, [isFile, artifact.type, artifact.fileType, artifact.source, artifact.title])

  const handleClick = React.useCallback(() => {
    if (artifactCtx) {
      artifactCtx.toggleArtifact(artifact)
    } else {
      onClick()
    }
  }, [artifactCtx, artifact, onClick])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      handleClick()
    }
  }

  return (
    <div
      data-artifact-card="true"
      data-artifact-type={artifact.type}
      role="button"
      tabIndex={0}
      aria-label={`${isOpen ? "Close" : "Open"} ${isFile ? "file " : ""}${title}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group/artifact relative flex w-[80%] max-w-md items-center justify-between gap-3 p-2.5 select-none",
        "rounded-lg border bg-card text-card-foreground transition-all duration-200",
        "cursor-pointer ring-muted hover:ring-3",
        "focus-visible:ring-3 focus-visible:ring-muted focus-visible:outline-none",
        isStreaming && "generating-border",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted text-foreground transition-colors">
          <ArtifactIcon
            type={artifact.type}
            fileType={isFile ? artifact.fileType : undefined}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium tracking-tight text-foreground transition-colors group-hover/artifact:text-primary">
            {title}
          </p>

          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground/80 uppercase">
              {subtitle}
            </span>
            {isFile && artifact.size && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>{artifact.size}</span>
              </>
            )}
            {isStreaming && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-primary">
                  <Spinner className="size-2.5" />
                  Generating...
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant={isOpen ? "secondary" : "outline"}
          size="xs"
          onClick={(e) => {
            e.stopPropagation()
            handleClick()
          }}
          className="h-7 rounded-md transition-all active:scale-95"
          title={isOpen ? "Close preview" : "Open preview"}
          aria-label={isOpen ? "Close preview" : "Open preview"}
        >
          {isOpen ? "Close" : "Open"}
        </Button>
      </div>
    </div>
  )
}

export function ArtifactCard(
  props: ArtifactCardProps & { className?: string }
) {
  if (props.artifact.mode === "inline" && props.artifact.type !== "file") {
    return <InlineArtifact {...props} />
  }

  return <SharedArtifactCard {...props} />
}
