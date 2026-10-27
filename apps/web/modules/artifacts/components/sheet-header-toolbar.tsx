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
  IconDownload,
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
  const isFileArtifact = artifact.type === "file"

  return (
    <div className="flex items-center gap-3 rounded-t-xl border-b border-border bg-card p-1.5">
      {hasCode ? (
        <Tabs
          value={view}
          onValueChange={(val) => onViewChange(val as View)}
          className="shrink-0"
        >
          <TabsList className="h-fit! px-1!">
            <TabsTrigger
              className="size-6"
              value="preview"
              aria-label="Preview"
              title="Preview"
            >
              <IconEye />
            </TabsTrigger>
            <TabsTrigger
              className="size-6"
              value="code"
              aria-label="Code"
              title="Code"
            >
              <IconCode />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : (
        <div />
      )}

      <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
        <SheetTitle className="truncate text-[13px] font-medium">
          {artifact.title}
        </SheetTitle>
        <SheetDescription className="sr-only">
          {typeLabel} artifact preview and source code
        </SheetDescription>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isFileArtifact ? (
          <Button
            variant="secondary"
            size="xs"
            onClick={onDownload}
            className="h-7 px-2"
          >
            <IconDownload />
            <span>Download</span>
          </Button>
        ) : (
          <ButtonGroup>
            <Button
              variant="secondary"
              size="xs"
              onClick={onCopy}
              className="h-7 px-2"
            >
              {copied ? <IconCheck /> : null}
              {copied ? "Copied" : "Copy"}
            </Button>

            <ButtonGroupSeparator />
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="More actions"
                className={buttonVariants({
                  variant: "secondary",
                  size: "icon-xs",
                  className: "size-7",
                })}
              >
                <IconChevronDown />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {!isFileArtifact && (
                  <DropdownMenuItem onClick={onDownload}>
                    Download as {typeLabel}
                  </DropdownMenuItem>
                )}

                {artifact.type === "html" && (
                  <>
                    <DropdownMenuItem onClick={onExportPdf}>
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

                {isFileArtifact && (
                  <DropdownMenuItem onClick={onCopy}>
                    {copied ? "Copied" : "Copy content"}
                  </DropdownMenuItem>
                )}

                {onPublish && (
                  <DropdownMenuItem onClick={() => onPublish(artifact)}>
                    Publish artifact
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        )}

        <Button
          variant="secondary"
          size="icon-xs"
          onClick={onToggleMaximize}
          aria-label={maximized ? "Restore size" : "Expand"}
          title={maximized ? "Restore" : "Expand"}
          className="hidden size-7 sm:flex"
        >
          {maximized ? <IconArrowsDiagonalMinimize2 /> : <IconArrowsDiagonal />}
        </Button>

        <Button
          variant="secondary"
          size="icon-xs"
          onClick={onClose}
          aria-label="Close"
          title="Close"
          className="size-7"
        >
          <IconX />
        </Button>
      </div>
    </div>
  )
}
