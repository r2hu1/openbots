import { db, getRedis, schedules } from "@openbots/db";
import { and, desc, eq } from "drizzle-orm";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { getAgent } from "./agents.logic.js";

type Env = {
  Variables: {
    user: { id: string };
  };
};

export async function handleUserAgentsStream(c: Context<Env>) {
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
                    data: typeof raw === "string" ? raw : JSON.stringify(raw),
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
}

export async function handleAgentStream(c: Context<Env>) {
  const user = c.get("user");
  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "Agent ID is required" }, 400);
  }
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
                    data: typeof raw === "string" ? raw : JSON.stringify(raw),
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
}
