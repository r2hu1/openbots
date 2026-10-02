"use client"

import { Button } from "@openbots/ui/components/button"
import {
  IconChartDots3,
  IconCode,
  IconMaximize,
  IconVectorTriangle,
} from "@tabler/icons-react"
import type { ParsedArtifact } from "./parser"
import { HtmlSandbox, MermaidSandbox, SvgSandbox } from "./sandboxes"

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
    <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-sidebar">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          <ArtifactIcon type={artifact.type} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-foreground">
            {artifact.title}
          </p>
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {artifact.type}
          </p>
        </div>

        <Button variant="secondary" size="xs" onClick={onClick}>
          Open
          <IconMaximize className="size-3" />
        </Button>
      </div>

      {/* Preview */}
      <div className="relative h-64 w-full overflow-hidden border-t border-border bg-sidebar">
        {artifact.type === "html" && (
          <HtmlSandbox
            code={artifact.content}
            className="size-full overflow-hidden border-0 bg-background"
          />
        )}
        {artifact.type === "svg" && (
          <SvgSandbox
            svg={artifact.content}
            className="size-full overflow-auto border-0 bg-background p-4"
          />
        )}
        {artifact.type === "mermaid" && (
          <MermaidSandbox
            code={artifact.content}
            className="size-full overflow-auto border-0 bg-background p-4"
          />
        )}
      </div>
    </div>
  )
}
