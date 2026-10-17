import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { getRedis } from "@openbots/db";
import { authMiddleware } from "../../middleware/auth.js";
import { handleRunStream } from "./runs.events-stream.js";
import { cancelRun, getRun, listRuns } from "./runs.logic.js";
import { hitlSchema } from "./runs.schema.js";
import { handleSingleRunStream } from "./runs.stream.js";

type Env = {
  Variables: {
    user: { id: string };
  };
};

export const runsRoute = new Hono<Env>()
  .use("*", authMiddleware)

  .get("/", async (c) => {
    const user = c.get("user");
    const agentId = c.req.query("agentId");
    const result = await listRuns(user.id, agentId);
    return c.json(result);
  })
  .get("/stream", handleRunStream)
  .get("/:id", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const result = await getRun(id, user.id);
    if (!result) {
      return c.json({ error: "Run not found" }, 404);
    }
    return c.json(result);
  })
  .get("/:id/stream", handleSingleRunStream)
  .post("/:id/cancel", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const result = await cancelRun(id, user.id);
    if ("error" in result) {
      return c.json({ error: result.error }, result.status);
    }
    return c.json({ run: result.run });
  })
  .post("/:id/hitl", zValidator("json", hitlSchema), async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const body = c.req.valid("json");

    const runData = await getRun(id, user.id);
    if (!runData) {
      return c.json({ error: "Run not found" }, 404);
    }

    const redis = getRedis();
    let effectiveContextKey = body.contextKey;
    if (!effectiveContextKey && redis) {
      effectiveContextKey =
        (await redis.get<string>(`hitl:pending:run:${id}`)) || undefined;
    }
    if (!effectiveContextKey) {
      effectiveContextKey =
        runData.run.conversationId || runData.run.agentId || user.id;
    }

    const { submitHumanInteractionResponse } = await import(
      "../../daytona/hitl.js"
    );

    const ok = await submitHumanInteractionResponse(effectiveContextKey, {
      action: body.action || "completed",
      notes: body.notes,
    });

    return c.json({ success: ok, contextKey: effectiveContextKey });
  });
