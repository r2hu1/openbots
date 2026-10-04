import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import {
  deleteConversationImage,
  getConversation,
  listConversations,
  searchTimelineMessages,
  toggleMessageReaction,
  uploadConversationImage,
} from "./conversations.logic.js";
import { getConversationQuerySchema } from "./conversations.schema.js";

type Env = {
  Variables: {
    user: { id: string };
  };
};

export const conversationsRoute = new Hono<Env>()
  .use("*", authMiddleware)

  .get("/search", async (c) => {
    const user = c.get("user");
    const q = c.req.query("q") || "";
    const limit = Number(c.req.query("limit")) || 20;
    const result = await searchTimelineMessages(user.id, q, limit);
    return c.json(result);
  })
  .get("/", async (c) => {
    const user = c.get("user");
    const agentId = c.req.query("agentId");
    const result = await listConversations(user.id, agentId);
    return c.json(result);
  })
  .post("/upload", async (c) => {
    const user = c.get("user");
    let file: any = null;

    try {
      const formData = await c.req.formData();
      file = formData.get("file");
    } catch {
      // Fallback to parseBody
      const body = ((await c.req.parseBody().catch(() => ({}))) ||
        {}) as Record<string, any>;
      file = body.file;
    }

    if (!file || typeof file === "string" || !(file instanceof Blob)) {
      return c.json({ error: "No image file provided." }, 400);
    }

    const fileName = (file as any).name || "image.png";
    const result = await uploadConversationImage(user.id, file, fileName);
    if ("error" in result) {
      return c.json({ error: result.error }, result.status);
    }
    return c.json(result);
  })
  .delete(
    "/upload",
    zValidator(
      "json",
      z.object({
        path: z.string().min(1),
      }),
    ),
    async (c) => {
      const user = c.get("user");
      const { path } = c.req.valid("json");
      const result = await deleteConversationImage(user.id, path);
      if ("error" in result) {
        return c.json({ error: result.error }, result.status);
      }
      return c.json(result);
    },
  )
  .post(
    "/messages/:messageId/reaction",
    zValidator(
      "json",
      z.object({
        emoji: z.string().min(1),
      }),
    ),
    async (c) => {
      const user = c.get("user");
      const messageId = c.req.param("messageId");
      const { emoji } = c.req.valid("json");
      const result = await toggleMessageReaction(user.id, messageId, emoji);
      if ("error" in result) {
        return c.json({ error: result.error }, result.status);
      }
      return c.json(result);
    },
  )
  .get("/:id", zValidator("query", getConversationQuerySchema), async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const { limit, before } = c.req.valid("query");
    const result = await getConversation(id, user.id, { limit, before });
    if (!result) {
      return c.json({ error: "Conversation not found" }, 404);
    }
    return c.json(result);
  });
