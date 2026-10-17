import type { Context } from "hono";
import { getAgent } from "./agents.logic.js";

type Env = {
  Variables: {
    user: { id: string };
  };
};

export async function handleAgentFiles(c: Context<Env>) {
  const user = c.get("user");
  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "Agent ID is required" }, 400);
  }
  const filePath = c.req.query("path");
  if (!filePath) {
    return c.json({ error: "Query parameter 'path' is required" }, 400);
  }

  const agent = await getAgent(id, user.id);
  if (!agent) {
    return c.json({ error: "Agent not found" }, 404);
  }

  try {
    if (agent.agent.sandboxId) {
      const { getAgentSandbox } = await import("../../daytona/sandbox.js");
      const sandbox = await getAgentSandbox(agent.agent.sandboxId);
      if (sandbox) {
        const buffer = await sandbox.fs.downloadFile(filePath);
        const rawName = filePath.split("/").pop() || "file.bin";
        const ext = rawName.includes(".")
          ? rawName.split(".").pop()!.toLowerCase()
          : "";
        const mimeMap: Record<string, string> = {
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
        const contentType = mimeMap[ext] || "application/octet-stream";
        return new Response(buffer as any, {
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `inline; filename="${rawName}"`,
          },
        });
      }
    }

    return c.json({ error: "Sandbox not running or file not found" }, 404);
  } catch (err: any) {
    return c.json(
      { error: `Failed to download file: ${err?.message || String(err)}` },
      500,
    );
  }
}
