export const cleanMarkdown = (text: string) => {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
};

export async function compileDocx(
  content: string,
  fileName: string,
  isHtmlContent: boolean,
  title?: string,
): Promise<Buffer> {
  if (isHtmlContent) {
    try {
      // @ts-expect-error html-to-docx lacks bundled TypeScript declaration types
      const htmlToDocxMod = await import("html-to-docx");
      const HTMLtoDOCX = htmlToDocxMod.default || htmlToDocxMod;
      const docxBuffer = await HTMLtoDOCX(content, null, {
        title: title || fileName.replace(/\.(docx|doc)$/i, ""),
      });
      return Buffer.from(docxBuffer as any);
    } catch (err) {
      console.warn("html-to-docx compilation failed, falling back to basic docx:", err);
    }
  }

  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
  const docTitle = title || fileName.replace(/\.(docx|doc)$/i, "");
  const paragraphs: any[] = [];

  if (docTitle) {
    paragraphs.push(
      new Paragraph({
        text: docTitle,
        heading: HeadingLevel.TITLE,
        spacing: { after: 240 },
      }),
    );
  }

  const rawLines = content.split("\n");
  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      paragraphs.push(new Paragraph({ text: "" }));
      continue;
    }

    if (line.startsWith("# ")) {
      paragraphs.push(
        new Paragraph({
          text: cleanMarkdown(line.replace(/^#\s+/, "")),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 120 },
        }),
      );
    } else if (line.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          text: cleanMarkdown(line.replace(/^##\s+/, "")),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 160, after: 80 },
        }),
      );
    } else if (line.startsWith("### ")) {
      paragraphs.push(
        new Paragraph({
          text: cleanMarkdown(line.replace(/^###\s+/, "")),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 120, after: 60 },
        }),
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun(cleanMarkdown(line.replace(/^[-*]\s+/, "")))],
          spacing: { after: 60 },
        }),
      );
    } else {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun(cleanMarkdown(line))],
          spacing: { after: 100 },
        }),
      );
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children: paragraphs }],
  });

  return await Packer.toBuffer(doc);
}
