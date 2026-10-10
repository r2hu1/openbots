import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { authMiddleware } from "../../middleware/auth.js";
import { db, getRedis, schedules } from "@openbots/db";
import { and, desc, eq } from "drizzle-orm";
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

  .get("/stream", async (c) => {
    const user = c.get("user");

    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache, no-transform");
    c.header("Connection", "keep-alive");
    c.header("X-Accel-Buffering", "no");

    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        event: "ready",
        data: JSON.stringify({ userId: user.id }),
      });

      const queue: Array<{ event: string; data: string }> = [];
      let lastSeenSeq = -1;

      let lastRedisLen = 0;
      try {
        const redis = getRedis();
        if (redis) {
          const channelKey = `user_agent_events:${user.id}`;
          lastRedisLen = (await redis.llen(channelKey).catch(() => 0)) ?? 0;
        }
      } catch {}

      try {
        let lastPing = Date.now();
        while (!stream.aborted) {
          try {
            const redis = getRedis();
            if (redis) {
              const channelKey = `user_agent_events:${user.id}`;
              const currentLen =
                (await redis.llen(channelKey).catch(() => 0)) ?? 0;
              if (currentLen > lastRedisLen) {
                const items = await redis.lrange(
                  channelKey,
                  lastRedisLen,
                  currentLen - 1,
                );
                lastRedisLen = currentLen;
                if (items && items.length > 0) {
                  for (const raw of items) {
                    const parsed =
                      typeof raw === "string" ? JSON.parse(raw) : raw;
                    if (parsed.seq !== undefined) {
                      if (parsed.seq <= lastSeenSeq) continue;
                      lastSeenSeq = parsed.seq;
                    }
                    queue.push({
                      event: parsed.type,
                      data:
                        typeof raw === "string" ? raw : JSON.stringify(raw),
                    });
                  }
                }
              }
            }
          } catch {}

          if (queue.length > 0) {
            const item = queue.shift()!;
            await stream.writeSSE({
              event: item.event,
              data: item.data,
            });
            continue;
          }

          // Ping heartbeat every 10s
          if (Date.now() - lastPing > 10_000) {
            lastPing = Date.now();
            try {
              await stream.writeSSE({ event: "ping", data: "{}" });
            } catch {}
          }

          // Poll interval 300ms for fast Redis sync without in-memory Map
          await new Promise<void>((resolve) => setTimeout(resolve, 300));
        }
      } finally {
        // Stream closed
      }
    });
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

    // Extract geo and timezone headers if present from edge proxy (Cloudflare, Vercel, AWS CloudFront)
    const geoCity =
      c.req.header("cf-ipcity") ||
      c.req.header("x-vercel-ip-city") ||
      c.req.header("x-geo-city") ||
      undefined;
    const geoRegion =
      c.req.header("cf-region") ||
      c.req.header("x-vercel-ip-country-region") ||
      c.req.header("x-geo-region") ||
      undefined;
    const geoCountry =
      c.req.header("cf-ipcountry") ||
      c.req.header("x-vercel-ip-country") ||
      c.req.header("x-geo-country") ||
      undefined;
    const geoTimezone =
      c.req.header("cf-timezone") ||
      c.req.header("x-vercel-ip-timezone") ||
      undefined;

    const enrichedClientContext = {
      ...data.clientContext,
      timezone: data.clientContext?.timezone || geoTimezone,
      city: data.clientContext?.city || geoCity,
      region: data.clientContext?.region || geoRegion,
      country: data.clientContext?.country || geoCountry,
    };

    const result = await createAgentRun(user.id, id, {
      ...data,
      clientContext: enrichedClientContext,
    });
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

      // Stream initial active schedules immediately so client is hydrated in real time
      try {
        const activeSchedules = await db
          .select()
          .from(schedules)
          .where(and(eq(schedules.agentId, id), eq(schedules.userId, user.id)))
          .orderBy(desc(schedules.createdAt));
        await stream.writeSSE({
          event: "schedules_init",
          data: JSON.stringify({ schedules: activeSchedules }),
        });
      } catch {}

      const queue: Array<{ event: string; data: string }> = [];
      let lastSeenSeq = -1;

      let lastRedisLen = 0;
      try {
        const redis = getRedis();
        if (redis) {
          const channelKey = `agent_events:${id}`;
          lastRedisLen = (await redis.llen(channelKey).catch(() => 0)) ?? 0;
        }
      } catch {}

      try {
        let lastPing = Date.now();
        while (!stream.aborted) {
          // Check cross-process events from Redis (dispatched by API server, Trigger.dev, or background workers)
          try {
            const redis = getRedis();
            if (redis) {
              const channelKey = `agent_events:${id}`;
              const currentLen =
                (await redis.llen(channelKey).catch(() => 0)) ?? 0;
              if (currentLen > lastRedisLen) {
                const items = await redis.lrange(
                  channelKey,
                  lastRedisLen,
                  currentLen - 1,
                );
                lastRedisLen = currentLen;
                if (items && items.length > 0) {
                  for (const raw of items) {
                    const parsed =
                      typeof raw === "string" ? JSON.parse(raw) : raw;
                    if (parsed.seq !== undefined) {
                      if (parsed.seq <= lastSeenSeq) continue;
                      lastSeenSeq = parsed.seq;
                    }
                    queue.push({
                      event: parsed.type,
                      data:
                        typeof raw === "string" ? raw : JSON.stringify(raw),
                    });
                  }
                }
              }
            }
          } catch {}

          if (queue.length > 0) {
            const item = queue.shift()!;
            await stream.writeSSE({
              event: item.event,
              data: item.data,
            });
            continue;
          }

          // Ping heartbeat every 10s
          if (Date.now() - lastPing > 10_000) {
            lastPing = Date.now();
            try {
              await stream.writeSSE({ event: "ping", data: "{}" });
            } catch {}
          }

          // Poll interval 300ms for fast Redis sync without in-memory Map
          await new Promise<void>((resolve) => setTimeout(resolve, 300));
        }
      } finally {
        // Stream closed
      }
    });
  });
