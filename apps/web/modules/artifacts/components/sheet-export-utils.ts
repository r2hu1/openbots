import { slugify } from "./sheet-common"

export async function exportMarkdownAsPdf(content: string, title: string) {
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

export async function exportMarkdownAsDocx(content: string, title: string) {
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
