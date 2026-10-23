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
  const isFile = artifact.type === "file"

  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-auto",
        isFile ? "p-0" : "p-4 sm:p-6",
        view !== "preview" && "hidden"
      )}
    >
      {artifact.type === "html" && (
        <HtmlSandbox
          code={artifact.content}
          className="size-full min-h-[500px] border-0 bg-transparent"
        />
      )}
      {artifact.type === "svg" && (
        <SvgSandbox
          svg={artifact.content}
          className="flex size-full items-center justify-center overflow-auto border-0 bg-transparent p-6 [&_svg]:max-h-full [&_svg]:max-w-full"
        />
      )}
      {artifact.type === "mermaid" && (
        <MermaidSandbox
          code={artifact.content}
          className="flex size-full items-center justify-center overflow-auto border-0 bg-transparent p-6 [&_svg]:max-h-full [&_svg]:max-w-full"
        />
      )}
      {artifact.type === "file" && (
        <FileViewer artifact={artifact} onDownload={onDownload} />
      )}
    </div>
  )
}
