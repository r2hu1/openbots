import { tool } from "ai";
import { z } from "zod";
import type { DaytonaSandboxContext } from "./context.js";

export function createDaytonaFileSystemTools(
  ctx: DaytonaSandboxContext,
): Record<string, any> {
  const { getSandbox, options } = ctx;
  const { agentId } = options;

  const bash = tool({
    description:
      "Executes shell commands in the agent's Daytona sandbox terminal. Returns stdout, stderr, and exit code. Use for installing packages, running scripts, compiling code, checking logs, and managing processes.",
    inputSchema: z.object({
      command: z.string().describe("The shell command to run in the sandbox"),
      cwd: z
        .string()
        .optional()
        .describe("Working directory for command execution"),
      timeoutSeconds: z
        .number()
        .default(60)
        .describe("Execution timeout in seconds"),
    }),
    execute: async ({ command, cwd }) => {
      try {
        const sandbox = await getSandbox();
        const cmd = cwd ? `cd "${cwd}" && ${command}` : command;
        const res = await sandbox.process.executeCommand(cmd);

        return {
          success: res.exitCode === 0,
          exitCode: res.exitCode,
          result: res.result,
          sandboxId: sandbox.id,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Bash command failed: ${err.message}`,
        };
      }
    },
  });

  const readFile = tool({
    description:
      "Reads the content of a file from the Daytona sandbox filesystem.",
    inputSchema: z.object({
      path: z
        .string()
        .describe("Relative or absolute path to the file inside the sandbox"),
    }),
    execute: async ({ path }) => {
      try {
        const sandbox = await getSandbox();
        const buffer = await sandbox.fs.downloadFile(path);
        const content = buffer.toString("utf-8");

        return {
          success: true,
          path,
          content,
          sizeBytes: buffer.length,
          sandboxId: sandbox.id,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Failed to read file '${path}': ${err.message}`,
        };
      }
    },
  });

  const writeFile = tool({
    description:
      "Writes text content to a file in the Daytona sandbox filesystem. Creates parent directories if needed.",
    inputSchema: z.object({
      path: z
        .string()
        .describe(
          "Relative or absolute path of the file to create or overwrite",
        ),
      content: z
        .string()
        .describe("The full text content to write into the file"),
    }),
    execute: async ({ path, content }) => {
      try {
        const sandbox = await getSandbox();
        const buffer = Buffer.from(content, "utf-8");
        await sandbox.fs.uploadFile(buffer, path);

        return {
          success: true,
          message: `Successfully wrote ${buffer.length} bytes to '${path}'`,
          path,
          sandboxId: sandbox.id,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Failed to write file '${path}': ${err.message}`,
        };
      }
    },
  });

  const listFiles = tool({
    description:
      "Lists files and directories at a path in the Daytona sandbox filesystem.",
    inputSchema: z.object({
      path: z
        .string()
        .default(".")
        .describe("Path to list (defaults to current working directory)"),
      depth: z
        .number()
        .default(1)
        .describe("Directory traversal depth (1 for immediate entries)"),
    }),
    execute: async ({ path, depth }) => {
      try {
        const sandbox = await getSandbox();
        const entries = await sandbox.fs.listFiles(path, { depth });

        return {
          success: true,
          path,
          entries: entries.map((e) => ({
            name: e.name,
            path: e.path,
            isDir: e.isDir,
            size: e.size,
            modTime: e.modTime,
          })),
          sandboxId: sandbox.id,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Failed to list files in '${path}': ${err.message}`,
        };
      }
    },
  });

  const saveAndShareFile = tool({
    description:
      "Exports or saves a file from the Daytona sandbox to downloadable storage, generating an interactive file card snippet that the user can download and preview in chat.",
    inputSchema: z.object({
      path: z
        .string()
        .describe(
          "Path to the file inside the Daytona sandbox (e.g. '/home/daytona/report.pdf')",
        ),
      title: z
        .string()
        .optional()
        .describe("User-friendly title for the file card"),
    }),
    execute: async ({ path, title }) => {
      try {
        const sandbox = await getSandbox();
        const fileBuffer = await sandbox.fs.downloadFile(path);
        const fileName = path.split("/").pop() || "document.bin";
        const ext = fileName.includes(".")
          ? fileName.split(".").pop()!.toLowerCase()
          : "bin";

        const uniqueId = crypto.randomUUID();
        const bucket =
          process.env.SUPABASE_STORAGE_BUCKET || "conversation-attachments";
        const storagePath = `shared/${uniqueId}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

        const mimeMap: Record<string, string> = {
          pdf: "application/pdf",
          docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          csv: "text/csv",
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          txt: "text/plain",
          json: "application/json",
          html: "text/html",
        };

        const contentType = mimeMap[ext] || "application/octet-stream";

        const { uploadStorageObject, getStoragePublicUrl } = await import(
          "@openbots/db"
        );

        let downloadUrl = "";
        const { error } = await uploadStorageObject({
          bucket,
          path: storagePath,
          fileBody: fileBuffer,
          contentType,
          upsert: false,
        });

        if (!error) {
          const { data: publicUrlData } = getStoragePublicUrl(
            bucket,
            storagePath,
          );
          downloadUrl = publicUrlData.publicUrl;
        } else if (agentId) {
          downloadUrl = `/api/agents/${agentId}/files?path=${encodeURIComponent(path)}`;
        }

        const nowIso = new Date().toISOString();
        const displayTitle = title || fileName;
        const artifactSnippet = `<openbots-artifact type="file" source="${downloadUrl}" fileType="${ext}" title="${displayTitle.replace(/"/g, "&quot;")}" size="${fileBuffer.length}" createdAt="${nowIso}" updatedAt="${nowIso}" />`;

        return {
          success: true,
          fileName,
          downloadUrl,
          sizeBytes: fileBuffer.length,
          inlineArtifactSnippet: artifactSnippet,
          instruction:
            "Include the `inlineArtifactSnippet` directly into your assistant markdown text response so the user gets an interactive file card in chat.",
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Failed to save and share file: ${err.message}`,
        };
      }
    },
  });

  return {
    bash,
    read_file: readFile,
    write_file: writeFile,
    list_files: listFiles,
    save_and_share_file: saveAndShareFile,
  };
}
