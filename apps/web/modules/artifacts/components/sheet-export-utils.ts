import { marked } from "marked"
import DOMPurify from "dompurify"
import { slugify } from "./sheet-common"
import { MARKDOWN_PRINT_STYLES } from "./markdown-print-styles"
import { formatMarkdownLine, parseInlineRuns } from "./docx-format-helpers"

export async function exportMarkdownAsPdf(content: string, title: string) {
  try {
    const rawHtml = await marked.parse(content, { gfm: true, breaks: true })
    const sanitizedHtml = DOMPurify.sanitize(rawHtml)

    const container = document.createElement("div")
    container.className = "markdown-print-container"
    container.innerHTML = `
      <style>${MARKDOWN_PRINT_STYLES}</style>
      <div style="padding: 20px 24px;">
        ${sanitizedHtml}
      </div>
    `

    container.style.position = "fixed"
    container.style.top = "-9999px"
    container.style.left = "0"
    container.style.width = "794px"
    container.style.backgroundColor = "#ffffff"
    document.body.appendChild(container)

    const html2pdf = (await import("html2pdf.js")).default
    const opt = {
      margin: [14, 14, 14, 14],
      filename: `${slugify(title || "document")}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        backgroundColor: "#ffffff",
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      },
      pagebreak: { mode: ["css", "legacy"] },
    }

    try {
      await (html2pdf() as any).set(opt).from(container).save()
    } finally {
      document.body.removeChild(container)
    }
  } catch (err) {
    console.error("HTML2PDF styled conversion failed, trying print fallback:", err)
    printFallback(content, title)
  }
}

function printFallback(content: string, title: string) {
  const printWindow = window.open("", "_blank")
  if (!printWindow) return
  const rawHtml = marked.parse(content, { gfm: true, breaks: true }) as string
  const sanitizedHtml = DOMPurify.sanitize(rawHtml)

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title || "Document"}</title>
        <style>${MARKDOWN_PRINT_STYLES}</style>
      </head>
      <body>
        <div style="padding: 20px 24px;">
          ${sanitizedHtml}
        </div>
      </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 350)
}

import type { Paragraph as ParagraphType } from "docx"

export async function exportMarkdownAsDocx(content: string, title: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } =
    await import("docx")

  const paragraphs: ParagraphType[] = []

  paragraphs.push(
    new Paragraph({
      text: title || "Document",
      heading: HeadingLevel.TITLE,
      spacing: { after: 280 },
    })
  )

  const rawLines = content.split("\n")
  let inCodeBlock = false
  let codeBuffer: string[] = []

  for (const line of rawLines) {
    const trimmed = line.trim()

    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: codeBuffer.join("\n"),
                font: "Consolas",
                size: 20,
                color: "1E293B",
              }),
            ],
            shading: { fill: "F1F5F9" },
            spacing: { before: 120, after: 120 },
          })
        )
        codeBuffer = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeBuffer.push(line)
      continue
    }

    if (!trimmed) {
      paragraphs.push(new Paragraph({ text: "", spacing: { after: 100 } }))
      continue
    }

    if (line.startsWith("# ")) {
      paragraphs.push(
        new Paragraph({
          text: formatMarkdownLine(line.replace(/^#\s+/, "")),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
        })
      )
    } else if (line.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          text: formatMarkdownLine(line.replace(/^##\s+/, "")),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      )
    } else if (line.startsWith("### ")) {
      paragraphs.push(
        new Paragraph({
          text: formatMarkdownLine(line.replace(/^###\s+/, "")),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 80 },
        })
      )
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          children: parseInlineRuns(line.replace(/^[-*]\s+/, ""), TextRun),
          spacing: { after: 60 },
        })
      )
    } else if (/^\d+\.\s+/.test(line)) {
      paragraphs.push(
        new Paragraph({
          children: parseInlineRuns(line.replace(/^\d+\.\s+/, ""), TextRun),
          spacing: { after: 60 },
        })
      )
    } else if (line.startsWith("> ")) {
      paragraphs.push(
        new Paragraph({
          children: parseInlineRuns(line.replace(/^>\s+/, ""), TextRun, { italic: true }),
          border: {
            left: { color: "3B82F6", size: 16, style: BorderStyle.SINGLE, space: 10 },
          },
          spacing: { before: 80, after: 80 },
        })
      )
    } else {
      paragraphs.push(
        new Paragraph({
          children: parseInlineRuns(line, TextRun),
          spacing: { after: 120 },
        })
      )
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: paragraphs,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${slugify(title || "document")}.docx`
  link.click()
  URL.revokeObjectURL(url)
}
