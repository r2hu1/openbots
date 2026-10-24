"use client"

import { Button } from "@openbots/ui/components/button"
import { Spinner } from "@openbots/ui/components/spinner"
import * as React from "react"
import { cn } from "@/lib/utils"
import { useArtifact } from "../artifact-context"
import {
  type ArtifactCardProps,
  ArtifactIcon,
  TYPE_LABEL,
} from "./artifact-card-common"

export function CardArtifact({ artifact, onClick }: ArtifactCardProps) {
  const artifactCtx = useArtifact()
  const isStreaming = artifact.isStreaming
  const isOpen = artifactCtx?.isOpen(artifact) ?? false
  const typeLabel = (TYPE_LABEL[artifact.type] ?? artifact.type).toUpperCase()

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
      aria-label={`${isOpen ? "Close" : "Open"} ${artifact.title}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group/artifact relative flex w-[80%] max-w-md items-center justify-between gap-3 p-2.5 select-none",
        "rounded-lg border bg-card text-card-foreground transition-all duration-200",
        "cursor-pointer ring-muted hover:ring-3",
        "focus-visible:ring-3 focus-visible:ring-muted focus-visible:outline-none",
        isStreaming && "generating-border"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted text-foreground transition-colors">
          <ArtifactIcon type={artifact.type} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium tracking-tight text-foreground transition-colors group-hover/artifact:text-primary">
            {artifact.title ||
              `Untitled ${TYPE_LABEL[artifact.type] ?? artifact.type}`}
          </p>

          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground/80 uppercase">
              {typeLabel}
            </span>
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
          className={"h-7 rounded-md transition-all active:scale-95"}
          title={isOpen ? "Close preview" : "Open preview"}
          aria-label={isOpen ? "Close preview" : "Open preview"}
        >
          {isOpen ? "Close" : "Open"}
        </Button>
      </div>
    </div>
  )
}
