import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth.js";
import { getConversation, listConversations } from "./conversations.logic.js";
import { getConversationQuerySchema } from "./conversations.schema.js";

type Env = {
  Variables: {
    user: { id: string };
  };
};

export const conversationsRoute = new Hono<Env>()
  .use("*", authMiddleware)

  .get("/", async (c) => {
    const user = c.get("user");
    const agentId = c.req.query("agentId");
    const result = await listConversations(user.id, agentId);
    return c.json(result);
  })
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

