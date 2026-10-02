"use client"

import {
  IconChartDots3,
  IconChevronRight,
  IconCode,
  IconVectorTriangle,
} from "@tabler/icons-react"
import type { ParsedArtifact } from "./parser"

interface ArtifactCardProps {
  artifact: ParsedArtifact
  onClick: () => void
}

function ArtifactIcon({ type }: { type: ParsedArtifact["type"] }) {
  switch (type) {
    case "svg":
      return <IconVectorTriangle className="size-4" />
    case "mermaid":
      return <IconChartDots3 className="size-4" />
    default:
      return <IconCode className="size-4" />
  }
}

export function ArtifactCard({ artifact, onClick }: ArtifactCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-2.5 rounded-lg bg-muted/50 px-2.5 py-2 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-foreground shadow-xs">
        <ArtifactIcon type={artifact.type} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">
          {artifact.title}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          <span className="font-medium tracking-wide uppercase">
            {artifact.type}
          </span>
          <span className="mx-1.5">·</span>
          Click to preview
        </p>
      </div>

      <IconChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}
