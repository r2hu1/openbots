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
import { Skeleton } from "@openbots/ui/components/skeleton"
import { Separator } from "@openbots/ui/components/separator"

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
          {isStreaming && <Skeleton className="h-80" />}
        </div>
      ) : (
        <Skeleton className="h-80" />
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
