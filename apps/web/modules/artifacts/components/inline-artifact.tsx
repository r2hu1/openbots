"use client"

import { Button } from "@openbots/ui/components/button"
import * as React from "react"
import { Check, Copy, Maximize } from "reicon-react"
import { cn } from "@/lib/utils"
import {
  type ArtifactCardProps,
  ArtifactPreview,
  useCopy,
} from "./artifact-card-common"

export function InlineArtifact({ artifact, onClick }: ArtifactCardProps) {
  const { copied, copy } = useCopy(artifact.content)
  const isStreaming = artifact.isStreaming
  const hasContent = artifact.content.trim().length > 0

  return (
    <div
      data-artifact-card="true"
      data-artifact-mode="inline"
      className={cn(
        "group/artifact relative inline-block w-full max-w-full align-top transition-all",
        "rounded-lg",
        isStreaming && "min-h-[120px]"
      )}
    >
      {hasContent ? (
        <div className="relative w-full overflow-hidden rounded-lg">
          <div>
            <ArtifactPreview
              artifact={artifact}
              fitContent
              htmlClassName="border-0 bg-transparent"
              mediaClassName="block w-fit max-w-full border-0 bg-transparent p-0 [&_svg]:block [&_svg]:max-w-full"
            />
          </div>
          {isStreaming && (
            <div className="pointer-events-none absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-full border border-primary/20 bg-background/85 px-2 py-0.5 text-[10px] font-medium text-primary shadow-xs backdrop-blur-md">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" />
              <span>Live</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-primary/25 bg-primary/5 p-4 text-xs text-primary">
          <div className="flex items-center gap-2">
            <span className="size-2 animate-ping rounded-full bg-primary" />
            <span className="font-medium">
              Generating {artifact.title || "interactive widget"}...
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground opacity-80">
            Rendering preview live as tokens arrive
          </p>
        </div>
      )}

      {!isStreaming && (
        <div
          className={cn(
            "absolute top-1 right-1 z-20",
            "flex items-center gap-0.5",
            "rounded-md bg-background/90 p-0.5",
            "shadow-xs backdrop-blur-sm",
            "opacity-0 transition-opacity",
            "group-hover/artifact:opacity-100",
            "group-focus-within/artifact:opacity-100",
            "[@media(hover:none)]:opacity-100"
          )}
          onClick={(e) => e.stopPropagation()}
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
