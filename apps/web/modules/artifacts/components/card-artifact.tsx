"use client"

import * as React from "react"
import { Maximize } from "reicon-react"
import { cn } from "@/lib/utils"
import {
  type ArtifactCardProps,
  ArtifactIcon,
  ArtifactPreview,
  MEDIA_CENTER,
  THUMB_SIZE,
  TYPE_LABEL,
  useThumbnailFrame,
} from "./artifact-card-common"

export function CardArtifact({ artifact, onClick }: ArtifactCardProps) {
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
        "rounded-xl border p-1",
        "bg-card text-left",
        "transition-all outline-none",
        isStreaming && "generating-border"
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
        ) : (
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
                <span>
                  {isStreaming
                    ? "Streaming live preview..."
                    : "Preparing preview..."}
                </span>
              </div>
            </div>
          </div>
        )}

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
            "bg-muted"
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
