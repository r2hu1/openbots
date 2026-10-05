import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { authMiddleware } from "../../middleware/auth.js";
import { agentEventHub } from "../runs/runs.logic.js";
import {
  createAgent,
  createAgentRun,
  deleteAgent,
  getAgent,
  getAgentSummary,
  getAgentTools,
  listAgents,
  listAvailableModels,
  toggleAgentTool,
  updateAgent,
} from "./agents.logic.js";
import {
  configureToolSchema,
  createAgentRunSchema,
  createAgentSchema,
  updateAgentSchema,
} from "./agents.schema.js";

type Env = {
  Variables: {
    user: { id: string };
  };
};

export const agentsRoute = new Hono<Env>()
  .get("/:id/summary", async (c) => {
    const id = c.req.param("id");
    const summary = await getAgentSummary(id);
    if (!summary) {
      return c.json({ error: "Agent not found" }, 404);
    }
    return c.json({ agent: summary });
  })

  .use("*", authMiddleware)

  .get("/models", async (c) => {
    const user = c.get("user");
    const result = await listAvailableModels(user.id);
    return c.json(result);
  })
  .get("/", async (c) => {
    const user = c.get("user");
    const result = await listAgents(user.id);
    return c.json(result);
  })

  .get("/:id", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const result = await getAgent(id, user.id);
    if (!result) {
      return c.json({ error: "Agent not found" }, 404);
    }
    return c.json(result);
  })
  .patch("/:id", zValidator("json", updateAgentSchema), async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const result = await updateAgent(id, user.id, data);
    if (!result) {
      return c.json({ error: "Agent not found" }, 404);
    }
    return c.json(result);
  })
  .get("/:id/tools", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const result = await getAgentTools(id, user.id);
    if (!result) {
      return c.json({ error: "Agent not found" }, 404);
    }
    return c.json(result);
  })
  .post("/:id/tools", zValidator("json", configureToolSchema), async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const result = await toggleAgentTool(id, user.id, data);
    if (!result) {
      return c.json({ error: "Agent not found" }, 404);
    }
    return c.json(result);
  })
  .post("/", zValidator("json", createAgentSchema), async (c) => {
    const user = c.get("user");
    const data = c.req.valid("json");
    const result = await createAgent(user.id, data);
    return c.json(result, 201);
  })
  .post("/:id/runs", zValidator("json", createAgentRunSchema), async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const result = await createAgentRun(user.id, id, data);
    if ("error" in result) {
      return c.json({ error: result.error }, result.status);
    }
    return c.json({ run: result.run }, 201);
  })
  .delete("/:id", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const result = await deleteAgent(id, user.id);
    if (!result) {
      return c.json({ error: "Agent not found" }, 404);
    }
    return c.json({ success: true, agent: result.agent });
  })
  .get("/:id/stream", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const agent = await getAgent(id, user.id);
    if (!agent) {
      return c.json({ error: "Agent not found" }, 404);
    }

    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache, no-transform");
    c.header("Connection", "keep-alive");
    c.header("X-Accel-Buffering", "no");

    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        event: "ready",
        data: JSON.stringify({ agentId: id }),
      });

      const queue: Array<{ event: string; data: string }> = [];
      let notifyResolver: (() => void) | null = null;

      const unsubscribe = agentEventHub.subscribe(id, (ev) => {
        queue.push({
          event: ev.type,
          data: JSON.stringify(ev),
        });
        if (notifyResolver) {
          notifyResolver();
          notifyResolver = null;
        }
      });

      try {
        while (!stream.aborted) {
          if (queue.length > 0) {
            const item = queue.shift()!;
            await stream.writeSSE({
              event: item.event,
              data: item.data,
            });
            continue;
          }

          // Wait for next event or 15s heartbeat
          await new Promise<void>((resolve) => {
            let timer: any = null;
            const cb = () => {
              if (timer) clearTimeout(timer);
              notifyResolver = null;
              resolve();
            };
            notifyResolver = cb;
            timer = setTimeout(async () => {
              try {
                await stream.writeSSE({ event: "ping", data: "{}" });
              } catch {}
              cb();
            }, 15000);
          });
        }
      } finally {
        unsubscribe();
      }
    });
  });
