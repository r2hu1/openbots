"use client";

import { Button } from "@openbots/ui/components/button";
import {
  IconArrowsDiagonal,
  IconChartDots3,
  IconCode,
  IconVectorTriangle,
} from "@tabler/icons-react";
import type { ParsedArtifact } from "./parser";
import { HtmlSandbox, MermaidSandbox, SvgSandbox } from "./sandboxes";

interface ArtifactCardProps {
  artifact: ParsedArtifact;
  onClick: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  html: "HTML",
  svg: "SVG",
  mermaid: "Diagram",
};

function ArtifactIcon({ type }: { type: ParsedArtifact["type"] }) {
  switch (type) {
    case "svg":
      return <IconVectorTriangle className="size-4" />;
    case "mermaid":
      return <IconChartDots3 className="size-4" />;
    default:
      return <IconCode className="size-4" />;
  }
}

export function ArtifactCard({ artifact, onClick }: ArtifactCardProps) {
  return (
    <div className="group/artifact w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-sidebar">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground">
          <ArtifactIcon type={artifact.type} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] leading-tight font-medium text-foreground">
            {artifact.title}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {TYPE_LABEL[artifact.type] ?? artifact.type}
          </p>
        </div>

        <Button size="xs" onClick={onClick} className="shrink-0 gap-1">
          Open
          <IconArrowsDiagonal className="size-3" />
        </Button>
      </div>

      {/* Preview */}
      <div className="relative h-64 w-full overflow-hidden border-t border-border bg-background">
        <div className="pointer-events-none size-full">
          {artifact.type === "html" && (
            <HtmlSandbox
              code={artifact.content}
              className="size-full overflow-hidden border-0 bg-background"
            />
          )}
          {artifact.type === "svg" && (
            <SvgSandbox
              svg={artifact.content}
              className="size-full overflow-hidden border-0 bg-background p-4"
            />
          )}
          {artifact.type === "mermaid" && (
            <MermaidSandbox
              code={artifact.content}
              className="size-full overflow-hidden border-0 bg-background p-4"
            />
          )}
        </div>

        {/* Click-anywhere overlay with hover affordance */}
        <button
          type="button"
          onClick={onClick}
          aria-label={`Open ${artifact.title}`}
          className="absolute inset-0 flex cursor-pointer items-end justify-end bg-transparent p-3 transition-colors outline-none hover:bg-foreground/[0.03] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <span className="flex items-center gap-1 rounded-md border border-border bg-background/90 px-2 py-1 text-[11px] font-medium text-foreground opacity-0 shadow-xs backdrop-blur-sm transition-opacity group-focus-within/artifact:opacity-100 group-hover/artifact:opacity-100">
            <IconArrowsDiagonal className="size-3" />
            Click to expand
          </span>
        </button>
      </div>
    </div>
  );
}
