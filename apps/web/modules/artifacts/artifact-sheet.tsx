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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@openbots/ui/components/sheet"
import { Tabs, TabsList, TabsTrigger } from "@openbots/ui/components/tabs"
import {
  IconArrowsDiagonal,
  IconArrowsDiagonalMinimize2,
  IconCheck,
  IconChevronDown,
  IconCode,
  IconDownload,
  IconEye,
  IconFile,
  IconFileSpreadsheet,
  IconFileText,
  IconFileTypePdf,
  IconX,
} from "@tabler/icons-react"
import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"
import type { ParsedArtifact } from "./parser"
import { HtmlSandbox, MermaidSandbox, SvgSandbox } from "./sandboxes"

interface ArtifactSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  artifact: ParsedArtifact | null
  onPublish?: (artifact: ParsedArtifact) => void
}

type View = "preview" | "code"
type Token = { text: string; cls?: string }

const FILE_META: Record<string, { ext: string; mime: string }> = {
  html: { ext: "html", mime: "text/html" },
  svg: { ext: "svg", mime: "image/svg+xml" },
  mermaid: { ext: "mmd", mime: "text/plain" },
  file: { ext: "bin", mime: "application/octet-stream" },
}

const TOKEN_RE = new RegExp(
  [
    "(<!--[\\s\\S]*?-->|\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*)",
    "(\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*'|`(?:\\\\.|[^`\\\\])*`)",
    "(<\\/?[A-Za-z][\\w:.-]*|\\/?>)",
    "(\\b\\d+(?:\\.\\d+)?\\b)",
    "(\\b(?:import|from|export|default|const|let|var|function|return|if|else|for|while|new|class|interface|type|async|await|true|false|null|undefined|typeof|this)\\b)",
  ].join("|"),
  "g"
)

const TOKEN_CLASSES = [
  "text-muted-foreground italic",
  "text-emerald-600 dark:text-lime-300",
  "text-orange-600 dark:text-orange-300",
  "text-amber-600 dark:text-amber-300",
  "text-violet-600 dark:text-violet-400",
]

function highlight(code: string, enabled: boolean): Token[][] {
  const tokens: Token[] = []

  if (!enabled) {
    tokens.push({ text: code })
  } else {
    let last = 0
    for (const match of code.matchAll(TOKEN_RE)) {
      const index = match.index ?? 0
      if (index > last) tokens.push({ text: code.slice(last, index) })
      const group = match.findIndex((value, i) => i > 0 && value !== undefined)
      tokens.push({ text: match[0], cls: TOKEN_CLASSES[group - 1] })
      last = index + match[0].length
    }
    if (last < code.length) tokens.push({ text: code.slice(last) })
  }

  let current: Token[] = []
  const lines: Token[][] = [current]
  for (const token of tokens) {
    const parts = token.text.split("\n")
    parts.forEach((part, i) => {
      if (i > 0) {
        current = []
        lines.push(current)
      }
      if (part) current.push({ text: part, cls: token.cls })
    })
  }
  return lines
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "artifact"
  )
}

async function exportMarkdownAsPdf(content: string, title: string) {
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF({ unit: "pt", format: "a4" })
  const margin = 40
  const pageWidth = pdf.internal.pageSize.getWidth()
  const maxLineWidth = pageWidth - margin * 2

  const cleanMarkdown = (text: string) => {
    return text
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .trim()
  }

  const docTitle = cleanMarkdown(title || "Document")
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(18)
  pdf.text(docTitle, margin, 50)

  pdf.setDrawColor(220, 225, 235)
  pdf.setLineWidth(0.8)
  pdf.line(margin, 60, pageWidth - margin, 60)

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(10)
  let y = 80

  const lines = content.split("\n")
  for (const rawLine of lines) {
    if (y > 780) {
      pdf.addPage()
      y = 50
    }

    if (!rawLine.trim()) {
      y += 10
      continue
    }

    const isH1 = rawLine.startsWith("# ")
    const isH2 = rawLine.startsWith("## ")
    const isH3 = rawLine.startsWith("### ")
    const isBullet = /^\s*[-*•]\s+/.test(rawLine)

    let cleanText = cleanMarkdown(
      rawLine.replace(/^#+\s*/, "").replace(/^\s*[-*•]\s+/, "")
    )

    let indent = margin
    if (isH1) {
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(14)
      y += 12
    } else if (isH2) {
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(12)
      y += 10
    } else if (isH3) {
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(10.5)
      y += 8
    } else if (isBullet) {
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(10)
      indent = margin + 12
      cleanText = `•  ${cleanText}`
    } else {
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(10)
    }

    const splitLines = pdf.splitTextToSize(
      cleanText,
      maxLineWidth - (indent - margin)
    )
    for (const sLine of splitLines) {
      if (y > 780) {
        pdf.addPage()
        y = 50
      }
      pdf.text(sLine, indent, y)
      y += 14
    }
  }

  pdf.save(`${slugify(title)}.pdf`)
}

async function exportMarkdownAsDocx(content: string, title: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } =
    await import("docx")
  const paragraphs: any[] = []
  paragraphs.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 240 },
    })
  )

  const rawLines = content.split("\n")
  for (const line of rawLines) {
    if (!line.trim()) {
      paragraphs.push(new Paragraph({ text: "" }))
      continue
    }
    if (line.startsWith("# ")) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^#\s+/, ""),
          heading: HeadingLevel.HEADING_1,
        })
      )
    } else if (line.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^##\s+/, ""),
          heading: HeadingLevel.HEADING_2,
        })
      )
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun(line.replace(/^[-*]\s+/, ""))],
        })
      )
    } else {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun(line)],
          spacing: { after: 100 },
        })
      )
    }
  }

  const doc = new Document({ sections: [{ children: paragraphs }] })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${slugify(title)}.docx`
  link.click()
  URL.revokeObjectURL(url)
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

    // If a direct source URL is provided (e.g. Supabase storage public URL)
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

    // 1. Client-side PDF Generation from Markdown
    if (effectiveExt === "pdf" && artifact.content) {
      try {
        await exportMarkdownAsPdf(artifact.content, artifact.title)
        return
      } catch (e) {
        console.warn("Client jsPDF export failed, falling back to text blob", e)
      }
    }

    // 2. Client-side DOCX Generation from Markdown
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
          "gap-0 overflow-hidden p-0! data-[side=right]:w-full data-[side=right]:sm:w-3/4 data-[side=right]:sm:max-w-4xl",
          maximized &&
            "data-[side=right]:sm:left-3 data-[side=right]:sm:w-auto! data-[side=right]:sm:max-w-none!"
        )}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-border p-1.5">
          {hasCode ? (
            <Tabs
              value={view}
              onValueChange={(value) => setView(value as View)}
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
              <Button variant="secondary" size="sm" onClick={handleCopy}>
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
                  <DropdownMenuItem onClick={handleDownload}>
                    Download as {typeLabel}
                  </DropdownMenuItem>

                  {artifact.type === "html" && (
                    <>
                      <DropdownMenuItem
                        onClick={async () => {
                          try {
                            const html2pdf = (await import("html2pdf.js"))
                              .default
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
                        onClick={async () => {
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
                      <DropdownMenuItem onClick={handleExportPdf}>
                        Export as PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportDocx}>
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
              onClick={() => setMaximized((v) => !v)}
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
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              title="Close"
            >
              <IconX />
            </Button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">
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
              <FileViewer artifact={artifact} onDownload={handleDownload} />
            )}
          </div>

          <div
            className={cn(
              "min-h-0 flex-1 overflow-auto bg-sidebar py-4 font-mono text-[13px] leading-6 [scrollbar-width:thin]",
              view !== "code" && "hidden"
            )}
          >
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((tokens, i) => (
                  <tr key={i} className="align-top">
                    <td className="w-14 min-w-14 pr-4 text-right text-muted-foreground/50 select-none">
                      {i + 1}
                    </td>
                    <td className="pr-6 [overflow-wrap:anywhere] whitespace-pre-wrap text-foreground">
                      {tokens.length === 0
                        ? " "
                        : tokens.map((token, j) => (
                            <span key={j} className={token.cls}>
                              {token.text}
                            </span>
                          ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function FileViewer({
  artifact,
  onDownload,
}: {
  artifact: ParsedArtifact
  onDownload: () => void
}) {
  const ext = (
    artifact.fileType ||
    artifact.source?.split(".").pop() ||
    artifact.title?.split(".").pop() ||
    "file"
  ).toLowerCase()

  const isPdf = ext === "pdf"
  const isImage = ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)
  const isSpreadsheet = ["xlsx", "xls", "csv"].includes(ext)

  const formattedSize = React.useMemo(() => {
    if (!artifact.size) return null
    const num = Number(artifact.size)
    if (isNaN(num)) return artifact.size
    if (num < 1024) return `${num} B`
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`
    return `${(num / (1024 * 1024)).toFixed(1)} MB`
  }, [artifact.size])

  // PDF Preview
  if (isPdf && (artifact.source || artifact.content)) {
    return (
      <PdfViewer
        source={artifact.source}
        content={artifact.content}
        title={artifact.title}
        onDownload={onDownload}
      />
    )
  }

  // Image Preview
  if (isImage && (artifact.source || artifact.content)) {
    const imgSrc =
      artifact.source ||
      (artifact.content.startsWith("data:")
        ? artifact.content
        : `data:image/${ext};base64,${artifact.content}`)
    return (
      <div className="flex size-full items-center justify-center overflow-auto bg-muted/20 p-6">
        <img
          src={imgSrc}
          alt={artifact.title}
          className="max-h-full max-w-full rounded-md border border-border object-contain shadow-sm"
        />
      </div>
    )
  }

  // DOCX / Word Document Preview
  if (
    (ext === "docx" || ext === "doc") &&
    (artifact.source || artifact.content)
  ) {
    return (
      <DocxViewer
        source={artifact.source}
        content={artifact.content}
        title={artifact.title}
        onDownload={onDownload}
      />
    )
  }

  // Spreadsheet (XLSX, XLS, CSV) Preview
  if (isSpreadsheet && (artifact.source || artifact.content)) {
    return (
      <SpreadsheetViewer
        source={artifact.source}
        content={artifact.content}
        ext={ext}
        onDownload={onDownload}
      />
    )
  }

  // Text & Markdown Document Preview (md, txt, json, csv, etc. via content or source fetch)
  const isTextDoc = [
    "md",
    "markdown",
    "txt",
    "text",
    "json",
    "log",
    "yaml",
    "yml",
    "xml",
    "toml",
  ].includes(ext)

  if (isTextDoc || (artifact.content && artifact.content.trim().length > 0)) {
    return (
      <MarkdownDocumentViewer
        source={artifact.source}
        content={artifact.content}
        title={artifact.title}
        ext={ext}
        onDownload={onDownload}
      />
    )
  }

  // Generic & Document Preview / Download Screen
  return (
    <div className="flex size-full flex-col items-center justify-center bg-background p-8 text-center">
      <div className="flex max-w-md flex-col items-center p-8 shadow-sm">
        <div className="flex size-16 items-center justify-center rounded-2xl border border-border/80 bg-muted/60 text-primary shadow-xs">
          {isPdf ? (
            <IconFileTypePdf className="size-8 text-red-500 dark:text-red-400" />
          ) : isSpreadsheet ? (
            <IconFileSpreadsheet className="size-8 text-emerald-600 dark:text-emerald-400" />
          ) : ext === "txt" || ext === "md" || ext === "json" ? (
            <IconFileText className="size-8 text-blue-500 dark:text-blue-400" />
          ) : (
            <IconFile className="size-8 text-primary" />
          )}
        </div>

        <h3 className="mt-4 line-clamp-2 text-lg font-semibold tracking-tight text-foreground">
          {artifact.title}
        </h3>

        <div className="mt-1.5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono font-semibold tracking-wide text-foreground/80 uppercase">
            {ext}
          </span>
          {formattedSize && (
            <>
              <span>·</span>
              <span>{formattedSize}</span>
            </>
          )}
          {artifact.createdAt && (
            <>
              <span>·</span>
              <span>{new Date(artifact.createdAt).toLocaleDateString()}</span>
            </>
          )}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          This file was generated and safely stored. Click below to download or
          view it in your preferred application.
        </p>

        <div className="mt-6 flex w-full flex-col gap-2.5">
          <Button onClick={onDownload}>
            <IconDownload className="size-4" />
            Download {ext.toUpperCase()}
          </Button>

          {artifact.source && (
            <a
              href={artifact.source}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Open source link in new tab
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function DocxViewer({
  source,
  content,
  title,
  onDownload,
}: {
  source?: string
  content?: string
  title: string
  onDownload: () => void
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [htmlContent, setHtmlContent] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true

    async function loadDocx() {
      setLoading(true)
      setError(null)
      setHtmlContent(null)

      try {
        let buffer: ArrayBuffer | null = null

        if (source) {
          const res = await fetch(source)
          if (!res.ok)
            throw new Error(`HTTP ${res.status}: Failed to fetch file`)
          buffer = await res.arrayBuffer()
        } else if (content) {
          if (content.startsWith("UEsDB") || content.length % 4 === 0) {
            try {
              const bin = atob(content)
              const bytes = new Uint8Array(bin.length)
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
              buffer = bytes.buffer
            } catch {
              // Not base64
            }
          }
        }

        if (!buffer) {
          throw new Error("No binary data available to render document preview")
        }

        // 1. Try rendering through mammoth for pristine, crisp HTML typography
        try {
          const mammoth = await import("mammoth")
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
          if (active && result.value && result.value.trim().length > 0) {
            setHtmlContent(result.value)
            setLoading(false)
            return
          }
        } catch (mammothErr) {
          console.warn("Mammoth HTML conversion fallback:", mammothErr)
        }

        // 2. Fallback to docx-preview canvas/DOM renderer if mammoth output is empty
        const { renderAsync } = await import("docx-preview")
        if (!active || !containerRef.current) return
        containerRef.current.innerHTML = ""
        await renderAsync(buffer, containerRef.current, undefined, {
          className: "docx-document",
          inWrapper: false,
          ignoreWidth: true,
          ignoreHeight: true,
        })
        setLoading(false)
      } catch (err: any) {
        if (!active) return
        setError(err?.message || "Failed to parse DOCX document")
        setLoading(false)
      }
    }

    loadDocx()

    return () => {
      active = false
    }
  }, [source, content])

  return (
    <div className="relative size-full overflow-auto bg-background">
      {loading && (
        <div className="flex size-full items-center justify-center py-20">
          <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Rendering document preview...</span>
          </div>
        </div>
      )}

      {error ? (
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <IconFile className="size-10 text-muted-foreground" />
          <h4 className="mt-3 text-sm font-semibold text-foreground">
            {title}
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {error.includes("PK") ||
            error.includes("zip") ||
            error.includes("binary")
              ? "This document contains plain formatted text or custom layout."
              : error}
          </p>
          {content && content.trim().length > 0 && (
            <div className="mt-4 max-h-60 w-full overflow-auto rounded-md bg-muted/30 p-3 text-left font-mono text-xs whitespace-pre-wrap select-text">
              {content}
            </div>
          )}
          <Button size="sm" className="mt-4" onClick={onDownload}>
            <IconDownload className="mr-1.5 size-4" />
            Download File
          </Button>
        </div>
      ) : htmlContent ? (
        <div className="mx-auto max-w-4xl px-6 py-8 select-text sm:px-12 sm:py-10">
          <div
            className="typeset"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
      ) : (
        <div
          ref={containerRef}
          className="mx-auto max-w-4xl bg-transparent p-6 select-text sm:p-10 [&_.docx-document]:bg-transparent [&_.docx-document]:p-0 [&_.docx-wrapper]:bg-transparent [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border/60 [&_td]:p-2.5 [&_th]:border [&_th]:border-border/60 [&_th]:p-2.5"
        />
      )}
    </div>
  )
}

function SpreadsheetViewer({
  source,
  content,
  ext,
  onDownload,
}: {
  source?: string
  content?: string
  ext: string
  onDownload: () => void
}) {
  const [data, setData] = React.useState<any[][]>([])
  const [sheetNames, setSheetNames] = React.useState<string[]>([])
  const [activeSheet, setActiveSheet] = React.useState<string>("")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true

    async function parseSpreadsheet() {
      setLoading(true)
      setError(null)

      try {
        const XLSX = await import("xlsx")
        let workbook: any = null

        if (source) {
          const res = await fetch(source)
          if (!res.ok)
            throw new Error(`HTTP ${res.status}: Failed to fetch file`)
          const ab = await res.arrayBuffer()
          workbook = XLSX.read(ab, { type: "array" })
        } else if (content) {
          workbook = XLSX.read(content, { type: "string" })
        }

        if (!workbook || !workbook.SheetNames?.length) {
          throw new Error("No sheet data found")
        }

        if (!active) return
        setSheetNames(workbook.SheetNames)
        const firstSheet = workbook.SheetNames[0]
        setActiveSheet(firstSheet)
        const sheet = workbook.Sheets[firstSheet]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
        setData(rows)
        setLoading(false)
      } catch (err: any) {
        if (!active) return
        setError(err?.message || "Failed to parse spreadsheet")
        setLoading(false)
      }
    }

    parseSpreadsheet()

    return () => {
      active = false
    }
  }, [source, content])

  if (loading) {
    return (
      <div className="flex size-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Loading spreadsheet...</span>
        </div>
      </div>
    )
  }

  if (error || !data.length) {
    return (
      <div className="flex size-full flex-col items-center justify-center p-6 text-center">
        <IconFileSpreadsheet className="size-10 text-emerald-600 dark:text-emerald-400" />
        <p className="mt-2 text-sm font-medium text-foreground">
          Unable to preview spreadsheet data directly
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        <Button size="sm" className="mt-4" onClick={onDownload}>
          <IconDownload className="mr-1.5 size-4" />
          Download {ext.toUpperCase()}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex size-full flex-col overflow-hidden bg-background">
      {sheetNames.length > 1 && (
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-muted/30 px-3 py-1.5">
          {sheetNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveSheet(name)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                activeSheet === name
                  ? "border border-border bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-4 select-text">
        <table className="w-full border-collapse text-left font-mono text-xs">
          <tbody>
            {data.map((row, rIdx) => (
              <tr
                key={rIdx}
                className={cn(
                  "border-b border-border/60 transition-colors hover:bg-muted/20",
                  rIdx === 0 &&
                    "sticky top-0 bg-muted/40 font-semibold text-foreground"
                )}
              >
                <td className="w-10 border-r border-border/40 bg-muted/20 px-2 py-1.5 text-center text-[10px] text-muted-foreground select-none">
                  {rIdx + 1}
                </td>
                {Array.isArray(row) &&
                  row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className="max-w-xs truncate border-r border-border/40 px-3 py-1.5"
                    >
                      {cell !== undefined && cell !== null ? String(cell) : ""}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PdfViewer({
  source,
  content,
  title,
  onDownload,
}: {
  source?: string
  content?: string
  title: string
  onDownload: () => void
}) {
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [useCanvasFallback, setUseCanvasFallback] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true
    let createdUrl: string | null = null

    async function preparePdfUrl() {
      setLoading(true)
      setError(null)

      try {
        if (source) {
          // If source is already a direct URL (HTTPS or data), we can use it directly
          if (active) {
            setBlobUrl(source)
            setLoading(false)
          }
          return
        }

        if (content) {
          let bytes: Uint8Array | null = null
          if (content.startsWith("data:application/pdf;base64,")) {
            const base64 = content.split(",")[1] || ""
            const bin = atob(base64)
            bytes = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
          } else if (content.startsWith("data:")) {
            const base64 = content.split(",")[1] || ""
            const bin = atob(base64)
            bytes = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
          } else {
            try {
              const bin = atob(content)
              bytes = new Uint8Array(bin.length)
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
            } catch {
              // Not valid base64
            }
          }

          if (bytes) {
            const blob = new Blob([bytes.buffer as ArrayBuffer], {
              type: "application/pdf",
            })
            createdUrl = URL.createObjectURL(blob)
            if (active) {
              setBlobUrl(createdUrl)
              setLoading(false)
            }
            return
          }
        }

        throw new Error("Unable to load PDF source")
      } catch (err: any) {
        if (!active) return
        setError(err?.message || "Failed to prepare PDF")
        setLoading(false)
      }
    }

    preparePdfUrl()

    return () => {
      active = false
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl)
      }
    }
  }, [source, content])

  if (loading) {
    return (
      <div className="flex size-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Loading PDF document...</span>
        </div>
      </div>
    )
  }

  if (error || (!blobUrl && !useCanvasFallback)) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center p-6 text-center">
        <IconFileTypePdf className="size-10 text-red-500 dark:text-red-400" />
        <h4 className="mt-3 text-sm font-semibold text-foreground">{title}</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          {error || "Unable to display PDF preview directly."}
        </p>
        <div className="mt-5 grid gap-2">
          <Button size="sm" className="w-full gap-1.5" onClick={onDownload}>
            <IconDownload className="size-3.5" />
            Download PDF
          </Button>
          {source && (
            <a
              href={source}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "w-full"
              )}
            >
              Open in tab
            </a>
          )}
        </div>
      </div>
    )
  }

  if (useCanvasFallback) {
    return (
      <PdfCanvasFallback
        source={source}
        content={content}
        title={title}
        onDownload={onDownload}
      />
    )
  }

  return (
    <div className="relative size-full bg-muted/20">
      <object
        data={`${blobUrl}#toolbar=1&navpanes=0`}
        type="application/pdf"
        className="size-full border-0"
      >
        {/* If the browser's PDF plugin is blocked or unavailable, render high-DPI canvas fallback */}
        <PdfCanvasFallback
          source={source}
          content={content}
          title={title}
          onDownload={onDownload}
        />
      </object>
    </div>
  )
}

function PdfCanvasFallback({
  source,
  content,
  title,
  onDownload,
}: {
  source?: string
  content?: string
  title: string
  onDownload: () => void
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [numPages, setNumPages] = React.useState(0)

  React.useEffect(() => {
    let active = true

    async function renderPdf() {
      if (!containerRef.current) return
      setLoading(true)
      setError(null)

      try {
        const pdfjsLib = await import("pdfjs-dist")
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

        let dataSrc: any = null
        if (source) {
          const res = await fetch(source)
          if (!res.ok)
            throw new Error(`HTTP ${res.status}: Failed to fetch PDF`)
          const ab = await res.arrayBuffer()
          dataSrc = { data: new Uint8Array(ab) }
        } else if (content) {
          if (content.startsWith("data:")) {
            const base64 = content.split(",")[1] || ""
            const bin = atob(base64)
            const bytes = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
            dataSrc = { data: bytes }
          } else {
            const bin = atob(content)
            const bytes = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
            dataSrc = { data: bytes }
          }
        }

        if (!dataSrc) throw new Error("No PDF source provided")

        const loadingTask = pdfjsLib.getDocument(dataSrc)
        const pdf = await loadingTask.promise
        if (!active || !containerRef.current) return

        setNumPages(pdf.numPages)
        containerRef.current.innerHTML = ""

        // Render with ultra crisp scale for vector-like clarity
        const dpr =
          typeof window !== "undefined"
            ? Math.max(window.devicePixelRatio || 1, 2)
            : 2
        const baseScale = 2.0

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (!active || !containerRef.current) return
          const page = await pdf.getPage(pageNum)
          const viewport = page.getViewport({ scale: baseScale })
          const scaledViewport = page.getViewport({ scale: baseScale * dpr })

          const pageWrapper = document.createElement("div")
          pageWrapper.className =
            "mb-8 flex flex-col items-center bg-transparent p-0"

          const canvas = document.createElement("canvas")
          const context = canvas.getContext("2d", { alpha: false })
          canvas.height = Math.floor(scaledViewport.height)
          canvas.width = Math.floor(scaledViewport.width)
          canvas.style.width = `${Math.floor(viewport.width)}px`
          canvas.style.height = `${Math.floor(viewport.height)}px`
          canvas.className = "max-w-full h-auto rounded-sm shadow-md bg-white"

          pageWrapper.appendChild(canvas)

          const pageLabel = document.createElement("div")
          pageLabel.className =
            "mt-3 text-[11px] text-muted-foreground/70 font-mono select-none"
          pageLabel.innerText = `${pageNum} / ${pdf.numPages}`
          pageWrapper.appendChild(pageLabel)

          containerRef.current.appendChild(pageWrapper)

          if (context) {
            await page.render({
              canvasContext: context,
              viewport: scaledViewport,
            }).promise
          }
        }

        setLoading(false)
      } catch (err: any) {
        if (!active) return
        setError(err?.message || "Failed to render PDF")
        setLoading(false)
      }
    }

    renderPdf()

    return () => {
      active = false
    }
  }, [source, content])

  return (
    <div className="relative size-full overflow-auto bg-muted/10 p-4 sm:p-10">
      {loading && (
        <div className="flex size-full items-center justify-center py-20">
          <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Rendering crisp PDF preview...</span>
          </div>
        </div>
      )}

      {error ? (
        <div className="mx-auto flex max-w-md flex-col items-center justify-center p-6 text-center shadow-xs">
          <IconFileTypePdf className="size-10 text-red-500 dark:text-red-400" />
          <h4 className="mt-3 text-sm font-semibold text-foreground">
            {title}
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {error.includes("Invalid PDF structure") ||
            error.includes("Missing PDF")
              ? "Unable to parse PDF data directly. You can download the file below."
              : error}
          </p>
          <div className="mt-5 flex w-full gap-2">
            <Button size="sm" className="w-full gap-1.5" onClick={onDownload}>
              <IconDownload className="size-3.5" />
              Download PDF
            </Button>
            {source && (
              <a
                href={source}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "w-full"
                )}
              >
                Open in tab
              </a>
            )}
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="mx-auto flex max-w-3xl flex-col items-center"
        />
      )}
    </div>
  )
}

function MarkdownDocumentViewer({
  source,
  content: initialContent,
  title,
  ext,
  onDownload,
}: {
  source?: string
  content?: string
  title: string
  ext: string
  onDownload: () => void
}) {
  const [text, setText] = React.useState<string>(initialContent || "")
  const [loading, setLoading] = React.useState<boolean>(
    !initialContent && !!source
  )
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (initialContent) {
      setText(initialContent)
      setLoading(false)
      return
    }

    if (!source) {
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError(null)

    fetch(source)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load file`)
        return res.text()
      })
      .then((data) => {
        if (active) {
          setText(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Failed to load document content")
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [source, initialContent])

  return (
    <div className="size-full overflow-auto bg-popover px-6 py-8 sm:px-12 sm:py-10">
      <div className="mx-auto max-w-3xl select-text">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Loading document...</span>
            </div>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            <p className="mb-3 font-medium text-destructive">{error}</p>
            <Button size="sm" onClick={onDownload}>
              Download {ext.toUpperCase()}
            </Button>
          </div>
        ) : (
          <div className="typeset">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
