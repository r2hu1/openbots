import { db, getRedis, runs, schedules } from "@openbots/db";
import { and, desc, eq } from "drizzle-orm";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import {
  agentLocalEmitter,
  userLocalEmitter,
  type UserAgentEvent,
} from "../runs/runs.events.js";
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

    // Immediately push any currently running agents for this user so sidebar hydrates active states on refresh
    try {
      const activeRuns = await db
        .select({ id: runs.id, agentId: runs.agentId, status: runs.status })
        .from(runs)
        .where(and(eq(runs.userId, user.id), eq(runs.status, "running")));
      for (const ar of activeRuns) {
        if (ar.agentId) {
          await stream.writeSSE({
            event: "run_status",
            data: JSON.stringify({
              type: "run_status",
              agentId: ar.agentId,
              runId: ar.id,
              status: "running",
            }),
          });
        }
      }
    } catch {}

    const queue: Array<{ event: string; data: string }> = [];
    let lastSeenSeq = -1;

    let notifyQueue: (() => void) | null = null;
    const wakeQueue = () => {
      if (notifyQueue) {
        const fn = notifyQueue;
        notifyQueue = null;
        fn();
      }
    };

    // Listen to local in-process user bus for instant event delivery
    const onLocalEvent = (ev: UserAgentEvent) => {
      queue.push({
        event: ev.type,
        data: JSON.stringify(ev),
      });
      wakeQueue();
    };
    userLocalEmitter.on(user.id, onLocalEvent);

    let lastRedisLen = 0;
    try {
      const redis = getRedis();
      if (redis) {
        const channelKey = `user_agent_events:${user.id}`;
        lastRedisLen = (await redis.llen(channelKey).catch(() => 0)) ?? 0;
      }
    } catch {}

    let lastRedisCheck = Date.now();
    try {
      let lastPing = Date.now();
      while (!stream.aborted) {
        while (queue.length > 0) {
          const item = queue.shift()!;
          await stream.writeSSE({
            event: item.event,
            data: item.data,
          });
        }

        // Only check remote Redis occasionally (every 10 seconds) to avoid burning Upstash command quotas
        if (Date.now() - lastRedisCheck >= 10000) {
          lastRedisCheck = Date.now();
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
        }

        while (queue.length > 0) {
          const item = queue.shift()!;
          await stream.writeSSE({
            event: item.event,
            data: item.data,
          });
        }

        // Ping heartbeat every 3s to prevent proxy/runtime idle-connection timeouts
        if (Date.now() - lastPing > 3_000) {
          lastPing = Date.now();
          try {
            await stream.writeSSE({ event: "ping", data: "{}" });
          } catch {}
        }

        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            let timer: any = null;
            notifyQueue = () => {
              if (timer) clearTimeout(timer);
              resolve();
            };
            timer = setTimeout(() => {
              notifyQueue = null;
              resolve();
            }, 1000);
          });
        }
      }
    } finally {
      userLocalEmitter.off(user.id, onLocalEvent);
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

    let notifyQueue: (() => void) | null = null;
    const wakeQueue = () => {
      if (notifyQueue) {
        const fn = notifyQueue;
        notifyQueue = null;
        fn();
      }
    };

    // Listen to local in-process agent bus
    const onLocalEvent = (ev: any) => {
      queue.push({
        event: ev.type,
        data: JSON.stringify(ev),
      });
      wakeQueue();
    };
    agentLocalEmitter.on(id, onLocalEvent);

    let lastRedisLen = 0;
    try {
      const redis = getRedis();
      if (redis) {
        const channelKey = `agent_events:${id}`;
        lastRedisLen = (await redis.llen(channelKey).catch(() => 0)) ?? 0;
      }
    } catch {}

    let lastRedisCheck = Date.now();
    try {
      let lastPing = Date.now();
      while (!stream.aborted) {
        while (queue.length > 0) {
          const item = queue.shift()!;
          await stream.writeSSE({
            event: item.event,
            data: item.data,
          });
        }

        // Only check remote Redis occasionally (every 10 seconds) to avoid burning Upstash command quotas
        if (Date.now() - lastRedisCheck >= 10000) {
          lastRedisCheck = Date.now();
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
        }

        while (queue.length > 0) {
          const item = queue.shift()!;
          await stream.writeSSE({
            event: item.event,
            data: item.data,
          });
        }

        // Ping heartbeat every 3s to prevent proxy/runtime idle-connection timeouts
        if (Date.now() - lastPing > 3_000) {
          lastPing = Date.now();
          try {
            await stream.writeSSE({ event: "ping", data: "{}" });
          } catch {}
        }

        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            let timer: any = null;
            notifyQueue = () => {
              if (timer) clearTimeout(timer);
              resolve();
            };
            timer = setTimeout(() => {
              notifyQueue = null;
              resolve();
            }, 1000);
          });
        }
      }
    } finally {
      agentLocalEmitter.off(id, onLocalEvent);
    }
  });
}
