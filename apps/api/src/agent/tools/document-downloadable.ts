import { z } from "zod";
import { tool } from "ai";
import { compileHtmlToPdf, compilePdfWithLib } from "./document-pdf.js";
import { compileDocx } from "./document-docx.js";

const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  html: "text/html",
  py: "text/x-python",
  js: "application/javascript",
  ts: "application/typescript",
  png: "image/png",
  jpg: "image/jpeg",
  svg: "image/svg+xml",
};

export function createDownloadableFileTool(userId: string) {
  return tool({
    description:
      "Create or save a generated document/file (PDF, DOCX, XLSX, CSV, JSON, code, HTML, TXT, etc.) into secure storage, and provide the user with a download link and an interactive inline artifact widget card.",
    inputSchema: z.object({
      fileName: z
        .string()
        .min(1)
        .describe("The name of the file to create, e.g. 'quarterly-report.pdf', 'sales-forecast.xlsx', 'script.py'"),
      content: z
        .string()
        .describe("Text content, CSV, JSON, HTML, or Base64-encoded binary content (for binary files like images or compiled PDFs)"),
      isBase64: z
        .boolean()
        .default(false)
        .describe("Set to true if content is base64-encoded binary data"),
      title: z
        .string()
        .optional()
        .describe("User-facing title for the downloadable file card (e.g. 'Q3 Financial Analysis')"),
      description: z
        .string()
        .optional()
        .describe("Brief description of the generated file's contents or purpose"),
    }),
    execute: async ({ fileName, content, isBase64, title, description }) => {
      try {
        const ext = fileName.includes(".")
          ? fileName.split(".").pop()!.toLowerCase()
          : "txt";

        const isHtmlContent =
          /<(!DOCTYPE\s+html|html|body|div|p|h[1-6]|table|style|section)/i.test(
            content
          );

        let rawBuffer: Buffer | null = null;

        if (ext === "pdf" && !isBase64 && !content.startsWith("%PDF")) {
          if (isHtmlContent) {
            rawBuffer = await compileHtmlToPdf(content);
          }
          if (!rawBuffer) {
            rawBuffer = await compilePdfWithLib(content, fileName, title);
          }
        } else if (
          (ext === "docx" || ext === "doc") &&
          !isBase64 &&
          !content.startsWith("PK")
        ) {
          rawBuffer = await compileDocx(content, fileName, isHtmlContent, title);
        } else {
          rawBuffer = isBase64
            ? Buffer.from(content, "base64")
            : Buffer.from(content, "utf-8");
        }

        if (!rawBuffer) {
          rawBuffer = Buffer.from(content, "utf-8");
        }

        const contentType = MIME_MAP[ext] || "application/octet-stream";
        const uniqueId = crypto.randomUUID();
        const bucket =
          process.env.SUPABASE_STORAGE_BUCKET || "conversation-attachments";
        const path = `${userId}/generated/${uniqueId}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

        const { uploadStorageObject, getStoragePublicUrl } = await import(
          "@openbots/db"
        );

        const { data, error } = await uploadStorageObject({
          bucket,
          path,
          fileBody: rawBuffer,
          contentType,
          upsert: false,
        });

        if (error || !data) {
          return {
            success: false,
            error: error?.message || "Failed to upload file to storage.",
          };
        }

        const { data: publicUrlData } = getStoragePublicUrl(bucket, path);
        const downloadUrl = publicUrlData.publicUrl;

        const nowIso = new Date().toISOString();
        const artifactSnippet = `<openbots-artifact type="file" source="${downloadUrl}" fileType="${ext}" title="${fileName.replace(/"/g, '&quot;')}" size="${rawBuffer.length}" createdAt="${nowIso}" updatedAt="${nowIso}" />`;

        return {
          success: true,
          fileName,
          downloadUrl,
          path,
          sizeBytes: rawBuffer.length,
          mimeType: contentType,
          inlineArtifactSnippet: artifactSnippet,
          instruction:
            "Include the `inlineArtifactSnippet` directly into your assistant markdown text response so the user gets an interactive file card in chat.",
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Failed to create downloadable file: ${err?.message || String(err)}`,
        };
      }
    },
  });
}
