import { tool } from "ai";
import { z } from "zod";

export const parseDocument = tool({
  description:
    "Extract and view text, slides, sheets, tables, and styling context from documents (PDF, DOCX, DOC, PPTX, PPT, XLSX, XLS, CSV, TXT, MD, JSON). Accepts a public URL or local Daytona sandbox file path.",
  inputSchema: z.object({
    source: z
      .string()
      .min(1)
      .describe("HTTP URL or sandbox file path of the document to parse"),
    fileName: z
      .string()
      .optional()
      .describe("Optional original file name including extension (e.g. 'quarterly-report.pdf') to assist with format detection"),
    maxPagesOrSheets: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe("Max pages or sheets to extract details from (default 20)"),
  }),
  execute: async ({ source, fileName, maxPagesOrSheets }) => {
    try {
      let buffer: Buffer;
      let effectiveName = fileName || "";

      if (source.startsWith("http://") || source.startsWith("https://")) {
        const urlObj = new URL(source);
        if (!effectiveName) {
          const pathParts = urlObj.pathname.split("/");
          effectiveName = decodeURIComponent(pathParts[pathParts.length - 1] || "");
        }
        const resp = await fetch(source);
        if (!resp.ok) {
          return { error: `Failed to download document from URL: HTTP ${resp.status} ${resp.statusText}` };
        }
        const ab = await resp.arrayBuffer();
        buffer = Buffer.from(ab);
      } else {
        const { readFileSync } = await import("node:fs");
        buffer = readFileSync(source);
        if (!effectiveName) {
          effectiveName = source.split("/").pop() || "";
        }
      }

      const lowerName = effectiveName.toLowerCase();
      const ext = lowerName.includes(".") ? lowerName.split(".").pop()! : "";

      // 1. PDF Parser
      if (ext === "pdf" || (!ext && buffer.subarray(0, 4).toString() === "%PDF")) {
        const pdfModule: any = await import("pdf-parse/lib/pdf-parse.js" as any);
        const pdfParse = pdfModule.default || pdfModule;
        const data = await pdfParse(buffer, {
          max: maxPagesOrSheets,
        });

        return {
          success: true,
          type: "pdf",
          fileName: effectiveName,
          numPages: data.numpages,
          info: data.info,
          metadata: data.metadata,
          text: data.text.slice(0, 100000),
          length: data.text.length,
          truncated: data.text.length > 100000,
        };
      }

      // 2. DOCX Parser (Word)
      if (ext === "docx" || ext === "doc") {
        const mammoth = (await import("mammoth")).default;
        const [htmlResult, textResult] = await Promise.all([
          mammoth.convertToHtml({ buffer }).catch(() => ({ value: "", messages: [] })),
          mammoth.extractRawText({ buffer }).catch(() => ({ value: "", messages: [] })),
        ]);

        return {
          success: true,
          type: "docx",
          fileName: effectiveName,
          html: htmlResult.value.slice(0, 50000),
          text: textResult.value.slice(0, 100000),
          stylingSummary: htmlResult.value.includes("<table")
            ? "Contains data tables"
            : htmlResult.value.includes("<h1") || htmlResult.value.includes("<h2")
              ? "Contains headings and formatted sections"
              : "Plain formatted document",
          warnings: htmlResult.messages.map((m: any) => m.message),
        };
      }

      // 3. PPTX Parser (PowerPoint Presentation)
      if (ext === "pptx" || ext === "ppt") {
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(buffer);
        const slideFiles: string[] = [];

        zip.forEach((relativePath) => {
          if (relativePath.startsWith("ppt/slides/slide") && relativePath.endsWith(".xml")) {
            slideFiles.push(relativePath);
          }
        });

        // Sort slide numbers naturally: slide1.xml, slide2.xml ...
        slideFiles.sort((a, b) => {
          const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || "0", 10);
          const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || "0", 10);
          return numA - numB;
        });

        const slides: Array<{ slideNumber: number; text: string }> = [];
        const limitSlides = slideFiles.slice(0, maxPagesOrSheets);

        for (const sf of limitSlides) {
          const content = await zip.file(sf)?.async("string");
          if (content) {
            const matches = content.match(/<a:t>([^<]*)<\/a:t>/g) || [];
            const slideText = matches
              .map((tag) => tag.replace(/<\/?a:t>/g, "").trim())
              .filter(Boolean)
              .join(" ");

            const slideNum = parseInt(sf.match(/slide(\d+)\.xml/)?.[1] || `${slides.length + 1}`, 10);
            slides.push({
              slideNumber: slideNum,
              text: slideText,
            });
          }
        }

        return {
          success: true,
          type: "pptx",
          fileName: effectiveName,
          totalSlides: slideFiles.length,
          slides,
        };
      }

      // 4. Excel / Spreadsheet Parser (XLSX, XLS, CSV)
      if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        const xlsx = await import("xlsx");
        const workbook = xlsx.read(buffer, { type: "buffer" });
        const sheetNames = workbook.SheetNames.slice(0, maxPagesOrSheets);

        const sheetsData: Record<string, { rowsCount: number; previewRows: any[]; csv: string }> = {};

        for (const name of sheetNames) {
          const sheet = workbook.Sheets[name];
          if (!sheet) continue;
          const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
          const csv = xlsx.utils.sheet_to_csv(sheet);
          sheetsData[name] = {
            rowsCount: rows.length,
            previewRows: rows.slice(0, 30),
            csv: csv.slice(0, 50000),
          };
        }

        return {
          success: true,
          type: "spreadsheet",
          fileName: effectiveName,
          totalSheets: workbook.SheetNames.length,
          sheetNames: workbook.SheetNames,
          sheets: sheetsData,
        };
      }

      // 5. Text / Markdown / Code / JSON fallback
      const textContent = buffer.toString("utf-8");
      return {
        success: true,
        type: "text",
        fileName: effectiveName,
        text: textContent.slice(0, 100000),
        sizeBytes: buffer.length,
        truncated: textContent.length > 100000,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to parse document: ${err?.message || String(err)}`,
      };
    }
  },
});
