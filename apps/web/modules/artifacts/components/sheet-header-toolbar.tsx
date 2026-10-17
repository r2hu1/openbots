"use client"

import { Button, buttonVariants } from "@openbots/ui/components/button"
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@openbots/ui/components/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openbots/ui/components/dropdown-menu"
import { SheetDescription, SheetTitle } from "@openbots/ui/components/sheet"
import { Tabs, TabsList, TabsTrigger } from "@openbots/ui/components/tabs"
import {
  IconArrowsDiagonal,
  IconArrowsDiagonalMinimize2,
  IconCheck,
  IconChevronDown,
  IconCode,
  IconEye,
  IconX,
} from "@tabler/icons-react"
import * as React from "react"
import type { ParsedArtifact } from "../parser"
import { type View, slugify } from "./sheet-common"

interface SheetHeaderToolbarProps {
  artifact: ParsedArtifact
  view: View
  onViewChange: (view: View) => void
  copied: boolean
  maximized: boolean
  onToggleMaximize: () => void
  onClose: () => void
  onCopy: () => void
  onDownload: () => void
  onExportPdf: () => void
  onExportDocx: () => void
  onPublish?: (artifact: ParsedArtifact) => void
  isMarkdownDoc: boolean
  typeLabel: string
  hasCode: boolean
}

export function SheetHeaderToolbar({
  artifact,
  view,
  onViewChange,
  copied,
  maximized,
  onToggleMaximize,
  onClose,
  onCopy,
  onDownload,
  onExportPdf,
  onExportDocx,
  onPublish,
  isMarkdownDoc,
  typeLabel,
  hasCode,
}: SheetHeaderToolbarProps) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border p-1.5">
      {hasCode ? (
        <Tabs
          value={view}
          onValueChange={(val) => onViewChange(val as View)}
          className="shrink-0"
        >
          <TabsList className="h-fit! px-1!">
            <TabsTrigger
              className="size-7"
              value="preview"
              aria-label="Preview"
              title="Preview"
            >
              <IconEye className="size-3.5" />
            </TabsTrigger>
            <TabsTrigger
              className="size-7"
              value="code"
              aria-label="Code"
              title="Code"
            >
              <IconCode className="size-3.5" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : (
        <div />
      )}

      <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
        <SheetTitle className="truncate text-sm font-medium">
          {artifact.title}
        </SheetTitle>
        <SheetDescription className="sr-only">
          {typeLabel} artifact preview and source code
        </SheetDescription>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <ButtonGroup>
          <Button variant="secondary" size="sm" onClick={onCopy}>
            {copied && <IconCheck />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <ButtonGroupSeparator />
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="More actions"
              className={buttonVariants({
                variant: "secondary",
                size: "icon-sm",
              })}
            >
              <IconChevronDown className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={onDownload}>
                Download as {typeLabel}
              </DropdownMenuItem>

              {artifact.type === "html" && (
                <>
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        const html2pdf = (await import("html2pdf.js")).default
                        const element = document.createElement("div")
                        element.innerHTML = artifact.content
                        element.style.padding = "24px"
                        element.style.fontFamily = "sans-serif"
                        const opt = {
                          margin: 10,
                          filename: `${slugify(artifact.title)}.pdf`,
                          image: { type: "jpeg", quality: 0.98 },
                          html2canvas: { scale: 2 },
                          jsPDF: {
                            unit: "mm",
                            format: "a4",
                            orientation: "portrait",
                          },
                        }
                        await (html2pdf() as any)
                          .set(opt)
                          .from(element)
                          .save()
                      } catch (err) {
                        console.error("PDF export failed:", err)
                      }
                    }}
                  >
                    Export as PDF
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      const blob = new Blob([artifact.content], {
                        type: "text/html",
                      })
                      const url = URL.createObjectURL(blob)
                      const link = document.createElement("a")
                      link.href = url
                      link.download = `${slugify(artifact.title)}.html`
                      link.click()
                      URL.revokeObjectURL(url)
                    }}
                  >
                    Export as HTML
                  </DropdownMenuItem>
                </>
              )}

              {isMarkdownDoc && (
                <>
                  <DropdownMenuItem onClick={onExportPdf}>
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onExportDocx}>
                    Export as Word (.docx)
                  </DropdownMenuItem>
                </>
              )}

              {onPublish && (
                <DropdownMenuItem onClick={() => onPublish(artifact)}>
                  Publish artifact
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>

        <Button
          variant="secondary"
          size="icon-sm"
          onClick={onToggleMaximize}
          aria-label={maximized ? "Restore size" : "Expand"}
          title={maximized ? "Restore" : "Expand"}
          className="hidden sm:flex"
        >
          {maximized ? (
            <IconArrowsDiagonalMinimize2 />
          ) : (
            <IconArrowsDiagonal />
          )}
        </Button>

        <Button
          variant="secondary"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close"
          title="Close"
        >
          <IconX />
        </Button>
      </div>
    </div>
  )
}
