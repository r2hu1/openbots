import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { deleteMemory, searchMemories, setMemory } from "./memories.logic.js";

type Env = {
  Variables: {
    user: { id: string };
  };
};

export const memoriesRoute = new Hono<Env>()
  .use("*", authMiddleware)

  // GET /api/memories - search or list memories
  .get("/", async (c) => {
    const user = c.get("user");
    const agentId = c.req.query("agentId");
    if (!agentId) {
      return c.json({ error: "agentId query parameter is required" }, 400);
    }
    const query = c.req.query("query") || undefined;
    const category = c.req.query("category") || undefined;
    const limit = Number(c.req.query("limit")) || 50;

    const results = await searchMemories({
      userId: user.id,
      agentId,
      query,
      category,
      limit,
    });
    return c.json({ memories: results });
  })

  // POST /api/memories - create or update a memory
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        agentId: z.string().uuid(),
        key: z.string().min(1),
        content: z.string().min(1),
        category: z.string().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
    ),
    async (c) => {
      const user = c.get("user");
      const { agentId, key, content, category, metadata } = c.req.valid("json");

      const memory = await setMemory({
        userId: user.id,
        agentId,
        key,
        content,
        category,
        metadata,
      });

      return c.json({ memory });
    },
  )

  // DELETE /api/memories/:idOrKey - delete a memory by key or ID
  .delete("/:idOrKey", async (c) => {
    const user = c.get("user");
    const agentId = c.req.query("agentId");
    if (!agentId) {
      return c.json({ error: "agentId query parameter is required" }, 400);
    }
    const idOrKey = c.req.param("idOrKey");
    const success = await deleteMemory(user.id, agentId, idOrKey);
    return c.json({ success });
  });
