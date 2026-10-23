"use client"

import { Button } from "@openbots/ui/components/button"
import { Spinner } from "@openbots/ui/components/spinner"
import * as React from "react"
import { Check, Copy } from "reicon-react"
import { cn } from "@/lib/utils"
import {
  type ArtifactCardProps,
  ArtifactIcon,
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
        isStreaming && "min-h-[140px]"
      )}
    >
      {isStreaming && (
        <div className="mb-2 flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ArtifactIcon type={artifact.type} className="size-3.5 text-primary" />
            <span className="font-medium text-foreground">
              {artifact.title || `Generating ${artifact.type.toUpperCase()} artifact...`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <Spinner className="size-3 text-primary" />
            <span>Building live...</span>
          </div>
        </div>
      )}

      {hasContent ? (
        <div className="relative w-full overflow-hidden rounded-lg">
          <div>
            <ArtifactPreview
              artifact={artifact}
              fitContent
              htmlClassName="border-0 bg-transparent p-0"
              mediaClassName="block w-full max-w-full border-0 bg-transparent p-0 [&_svg]:block [&_svg]:w-full [&_svg]:max-w-full [&_svg]:h-auto"
            />
          </div>
        </div>
      ) : (
        <div className="flex h-36 w-full items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner className="size-4 text-primary" />
            <span>Preparing visual artifact...</span>
          </div>
        </div>
      )}

      {!isStreaming && (
        <div
          className={cn(
            "absolute top-1 right-1 z-20",
            "flex items-center gap-0.5",
            "rounded-xl bg-background p-0.5",
            "border backdrop-blur-sm",
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
        </div>
      )}
    </div>
  )
}
