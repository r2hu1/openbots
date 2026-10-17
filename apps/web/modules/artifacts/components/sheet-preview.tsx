"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { ParsedArtifact } from "../parser"
import { HtmlSandbox, MermaidSandbox, SvgSandbox } from "../sandboxes"
import { FileViewer } from "./file-viewer"
import type { View } from "./sheet-common"

export function SheetPreview({
  artifact,
  view,
  onDownload,
}: {
  artifact: ParsedArtifact
  view: View
  onDownload: () => void
}) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-hidden",
        view !== "preview" && "hidden"
      )}
    >
      {artifact.type === "html" && (
        <HtmlSandbox
          code={artifact.content}
          className="size-full border-0 bg-background"
        />
      )}
      {artifact.type === "svg" && (
        <SvgSandbox
          svg={artifact.content}
          className="flex size-full items-center justify-center overflow-auto border-0 bg-background p-6 [&_svg]:max-h-full [&_svg]:max-w-full"
        />
      )}
      {artifact.type === "mermaid" && (
        <MermaidSandbox
          code={artifact.content}
          className="flex size-full items-center justify-center overflow-auto border-0 bg-background p-6 [&_svg]:max-h-full [&_svg]:max-w-full"
        />
      )}
      {artifact.type === "file" && (
        <FileViewer artifact={artifact} onDownload={onDownload} />
      )}
    </div>
  )
}
