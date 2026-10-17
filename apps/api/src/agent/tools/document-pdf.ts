import { cleanMarkdown } from "./document-docx.js";

export async function compileHtmlToPdf(html: string): Promise<Buffer | null> {
  try {
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    const { spawn } = await import("child_process");

    const candidateBrowsers = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
    ];

    let browserPath: string | null = null;
    for (const b of candidateBrowsers) {
      if (fs.existsSync(b)) {
        browserPath = b;
        break;
      }
    }

    if (!browserPath) return null;

    const tmpId = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const tmpHtml = path.join(os.tmpdir(), `${tmpId}.html`);
    const tmpPdf = path.join(os.tmpdir(), `${tmpId}.pdf`);

    let fullHtml = html;
    if (!/<html/i.test(fullHtml)) {
      fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
        h1, h2, h3 { color: #0f172a; margin-top: 1.5em; margin-bottom: 0.5em; }
        h1 { font-size: 24pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-top: 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
        th { background-color: #f8fafc; font-weight: 600; }
        ul, ol { padding-left: 20px; }
        li { margin-bottom: 6px; }
        @page { margin: 20mm; size: A4; }
      </style></head><body>${fullHtml}</body></html>`;
    }

    await fs.promises.writeFile(tmpHtml, fullHtml, "utf-8");

    const child = spawn(browserPath, [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      `--print-to-pdf=${tmpPdf}`,
      tmpHtml,
    ]);

    await new Promise<void>((resolve, reject) => {
      child.on("close", (code) => {
        if (code === 0 && fs.existsSync(tmpPdf)) resolve();
        else reject(new Error(`Headless browser exited with code ${code}`));
      });
      child.on("error", reject);
    });

    const pdfBuf = await fs.promises.readFile(tmpPdf);
    await fs.promises.unlink(tmpHtml).catch(() => {});
    await fs.promises.unlink(tmpPdf).catch(() => {});
    return pdfBuf;
  } catch (err) {
    console.warn("Headless browser PDF compile failed, falling back to pdf-lib:", err);
    return null;
  }
}

export async function compilePdfWithLib(
  content: string,
  fileName: string,
  title?: string,
): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const docTitle = title || fileName.replace(/\.pdf$/i, "");
  const margin = 48;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const printableWidth = pageWidth - margin * 2;
  const lineHeight = 16;
  const fontSize = 10.5;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  if (docTitle) {
    page.drawText(cleanMarkdown(docTitle), {
      x: margin,
      y: y - 8,
      size: 20,
      font: boldFont,
      color: rgb(0.08, 0.1, 0.16),
    });
    y -= 26;
    page.drawLine({
      start: { x: margin, y: y },
      end: { x: pageWidth - margin, y: y },
      thickness: 1,
      color: rgb(0.85, 0.88, 0.92),
    });
    y -= 20;
  }

  const lines = content.split("\n");
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      y -= lineHeight * 0.8;
      continue;
    }

    const isH1 = rawLine.startsWith("# ");
    const isH2 = rawLine.startsWith("## ");
    const isH3 = rawLine.startsWith("### ");
    const isBullet = /^\s*[-*•]\s+/.test(rawLine);
    const isSubBullet = /^\s{2,}[-*•]\s+/.test(rawLine);

    let cleanLine = cleanMarkdown(
      rawLine.replace(/^#+\s*/, "").replace(/^\s*[-*•]\s+/, ""),
    );

    let currentFont = font;
    let currentSize = fontSize;
    let currentLineHeight = lineHeight;
    let textColor = rgb(0.18, 0.2, 0.24);
    let indent = margin;

    if (isH1) {
      currentFont = boldFont;
      currentSize = 14;
      currentLineHeight = 24;
      textColor = rgb(0.08, 0.1, 0.16);
      y -= 10;
    } else if (isH2) {
      currentFont = boldFont;
      currentSize = 12;
      currentLineHeight = 20;
      textColor = rgb(0.12, 0.14, 0.2);
      y -= 8;
    } else if (isH3) {
      currentFont = boldFont;
      currentSize = 10.5;
      currentLineHeight = 18;
      textColor = rgb(0.15, 0.18, 0.25);
      y -= 6;
    } else if (isBullet) {
      indent = margin + (isSubBullet ? 24 : 14);
      cleanLine = `•  ${cleanLine}`;
    }

    const availableWidth = printableWidth - (indent - margin);
    const words = cleanLine.split(" ");
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = currentFont.widthOfTextAtSize(testLine, currentSize);
      if (textWidth > availableWidth && currentLine) {
        if (y < margin + currentLineHeight) {
          page = doc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        page.drawText(currentLine, {
          x: indent,
          y,
          size: currentSize,
          font: currentFont,
          color: textColor,
        });
        y -= currentLineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      if (y < margin + currentLineHeight) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(currentLine, {
        x: indent,
        y,
        size: currentSize,
        font: currentFont,
        color: textColor,
      });
      y -= currentLineHeight;
    }
  }

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
