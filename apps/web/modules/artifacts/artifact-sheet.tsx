"use client"

import { Sheet, SheetContent } from "@openbots/ui/components/sheet"
import * as React from "react"
import { cn } from "@/lib/utils"
import type { ParsedArtifact } from "./parser"
import { SheetCodeEditor } from "./components/sheet-code-editor"
import {
  type View,
  FILE_META,
  highlight,
  slugify,
} from "./components/sheet-common"
import {
  exportMarkdownAsDocx,
  exportMarkdownAsPdf,
} from "./components/sheet-export-utils"
import { SheetHeaderToolbar } from "./components/sheet-header-toolbar"
import { SheetPreview } from "./components/sheet-preview"

export interface ArtifactSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  artifact: ParsedArtifact | null
  onPublish?: (artifact: ParsedArtifact) => void
}

export function ArtifactSheet({
  open,
  onOpenChange,
  artifact,
  onPublish,
}: ArtifactSheetProps) {
  const [view, setView] = React.useState<View>("preview")
  const [copied, setCopied] = React.useState(false)
  const [maximized, setMaximized] = React.useState(false)
  const copyTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    setView("preview")
  }, [artifact])

  React.useEffect(() => {
    return () => {
      if (copyTimeout.current) clearTimeout(copyTimeout.current)
    }
  }, [])

  const lines = React.useMemo(
    () =>
      artifact ? highlight(artifact.content, artifact.type !== "mermaid") : [],
    [artifact]
  )

  const handleCopy = React.useCallback(async () => {
    if (!artifact?.content) return
    try {
      await navigator.clipboard.writeText(artifact.content)
      setCopied(true)
      if (copyTimeout.current) clearTimeout(copyTimeout.current)
      copyTimeout.current = setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy code:", err)
    }
  }, [artifact])

  const handleDownload = React.useCallback(async () => {
    if (!artifact) return

    if (artifact.source) {
      const link = document.createElement("a")
      link.href = artifact.source
      link.download = artifact.title
      link.target = "_blank"
      link.rel = "noopener noreferrer"
      link.click()
      return
    }

    const effectiveExt = (
      artifact.fileType ||
      artifact.title?.split(".").pop() ||
      artifact.type ||
      "txt"
    ).toLowerCase()

    if (effectiveExt === "pdf" && artifact.content) {
      try {
        await exportMarkdownAsPdf(artifact.content, artifact.title)
        return
      } catch (e) {
        console.warn("Client jsPDF export failed, falling back to text blob", e)
      }
    }

    if (
      (effectiveExt === "docx" || effectiveExt === "doc") &&
      artifact.content
    ) {
      try {
        await exportMarkdownAsDocx(artifact.content, artifact.title)
        return
      } catch (e) {
        console.warn("Client docx export failed, falling back", e)
      }
    }

    const meta = FILE_META[artifact.type] ?? {
      ext: effectiveExt,
      mime: "text/plain",
    }
    const blob = new Blob([artifact.content], { type: meta.mime })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${slugify(artifact.title)}.${meta.ext}`
    link.click()
    URL.revokeObjectURL(url)
  }, [artifact])

  const getEffectiveContent = React.useCallback(async () => {
    if (!artifact) return ""
    if (artifact.content) return artifact.content
    if (artifact.source) {
      try {
        const res = await fetch(artifact.source)
        if (res.ok) return await res.text()
      } catch (e) {
        console.error("Failed to fetch content from source", e)
      }
    }
    return ""
  }, [artifact])

  const handleExportPdf = React.useCallback(async () => {
    if (!artifact) return
    const content = await getEffectiveContent()
    if (!content) return
    await exportMarkdownAsPdf(content, artifact.title)
  }, [artifact, getEffectiveContent])

  const handleExportDocx = React.useCallback(async () => {
    if (!artifact) return
    const content = await getEffectiveContent()
    if (!content) return
    await exportMarkdownAsDocx(content, artifact.title)
  }, [artifact, getEffectiveContent])

  if (!artifact) return null

  const effectiveExt = (
    artifact.fileType ||
    artifact.title?.split(".").pop() ||
    artifact.type ||
    "txt"
  ).toLowerCase()

  const isMarkdownDoc =
    effectiveExt === "md" ||
    effectiveExt === "markdown" ||
    effectiveExt === "txt" ||
    effectiveExt === "text" ||
    (artifact.type as string) === "markdown"

  const typeLabel =
    artifact.type === "file"
      ? (artifact.fileType || "File").toUpperCase()
      : artifact.type.toUpperCase()

  const hasCode = artifact.type !== "file" || !!artifact.content

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      variant={maximized ? "floating" : "sidebar"}
    >
      <SheetContent
        alwaysDark={false}
        showCloseButton={false}
        side="right"
        className={cn(
          "gap-0 overflow-hidden p-0!",
          maximized
            ? "ring-0 data-[side=right]:sm:left-3 data-[side=right]:sm:w-auto! data-[side=right]:sm:max-w-none!"
            : "data-[side=right]:max-w-none!"
        )}
      >
        <SheetHeaderToolbar
          artifact={artifact}
          view={view}
          onViewChange={setView}
          copied={copied}
          maximized={maximized}
          onToggleMaximize={() => setMaximized((v) => !v)}
          onClose={() => onOpenChange(false)}
          onCopy={handleCopy}
          onDownload={handleDownload}
          onExportPdf={handleExportPdf}
          onExportDocx={handleExportDocx}
          onPublish={onPublish}
          isMarkdownDoc={isMarkdownDoc}
          typeLabel={typeLabel}
          hasCode={hasCode}
        />

        <div className="relative flex min-h-0 flex-1 flex-col">
          <SheetPreview
            artifact={artifact}
            view={view}
            onDownload={handleDownload}
          />
          {view === "code" && <SheetCodeEditor lines={lines} />}
        </div>
      </SheetContent>
    </Sheet>
  )
}
