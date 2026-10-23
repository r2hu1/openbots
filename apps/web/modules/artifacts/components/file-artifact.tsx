"use client"

import { Button } from "@openbots/ui/components/button"
import * as React from "react"
import { cn } from "@/lib/utils"
import { useArtifact } from "../artifact-context"
import { type ArtifactCardProps, ArtifactIcon } from "./artifact-card-common"

export function FileArtifact({ artifact, onClick }: ArtifactCardProps) {
  const artifactCtx = useArtifact()
  const isStreaming = artifact.isStreaming
  const isOpen = artifactCtx?.isOpen(artifact) ?? false
  const ext = (
    artifact.fileType ||
    artifact.source?.split(".").pop() ||
    artifact.title?.split(".").pop() ||
    "file"
  ).toUpperCase()

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
      data-artifact-type="file"
      role="button"
      tabIndex={0}
      aria-label={`${isOpen ? "Close" : "Open"} file ${artifact.title}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group/artifact relative flex w-full max-w-md items-center justify-between gap-3 p-3 select-none",
        "rounded-xl border bg-card text-card-foreground transition-all duration-200",
        "cursor-pointer ring-muted hover:ring-3",
        "focus-visible:ring-3 focus-visible:ring-muted focus-visible:outline-none",
        isStreaming && "generating-border"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-foreground transition-colors">
          <ArtifactIcon type="file" fileType={artifact.fileType} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium tracking-tight text-foreground transition-colors group-hover/artifact:text-primary">
            {artifact.title}
          </p>

          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground/80 uppercase">
              {ext}
            </span>
            {artifact.size && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>{artifact.size}</span>
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
          className={cn(
            "h-7 rounded-md transition-all active:scale-95",
            isOpen
              ? "bg-primary/15 text-primary hover:bg-primary/25 font-medium"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          title={isOpen ? "Close preview" : "Open preview"}
          aria-label={isOpen ? "Close preview" : "Open preview"}
        >
          {isOpen ? "Close" : "Open"}
        </Button>
      </div>
    </div>
  )
}
