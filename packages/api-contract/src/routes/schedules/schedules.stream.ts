import { getRedis } from "@openbots/db";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { userLocalEmitter, type UserAgentEvent } from "../runs/runs.events.js";

type Env = {
  Variables: {
    user: { id: string };
  };
};

export async function handleSchedulesStream(c: Context<Env>) {
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

    const queue: string[] = [];
    let notifyQueue: (() => void) | null = null;
    const wakeQueue = () => {
      if (notifyQueue) {
        const fn = notifyQueue;
        notifyQueue = null;
        fn();
      }
    };

    const onLocalUserEvent = (ev: UserAgentEvent) => {
      if (
        ev.type === "schedule_updated" ||
        ev.type === "schedule_fired" ||
        ev.type === ("schedules_init" as any)
      ) {
        queue.push(JSON.stringify(ev));
        wakeQueue();
      }
    };
    userLocalEmitter.on(user.id, onLocalUserEvent);

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
            event: "schedule",
            data: item,
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
                for (const item of items) {
                  if (stream.aborted) break;
                  try {
                    const parsed = JSON.parse(item);
                    if (
                      parsed.type === "schedule_updated" ||
                      parsed.type === "schedule_fired" ||
                      parsed.type === "schedules_init"
                    ) {
                      await stream.writeSSE({
                        event: "schedule",
                        data: item,
                      });
                    }
                  } catch {}
                }
              }
            }
          } catch {}
        }

        if (Date.now() - lastPing >= 15000) {
          await stream.writeSSE({ event: "ping", data: "" });
          lastPing = Date.now();
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
    } catch (err) {
      console.warn("Schedules SSE stream closed or interrupted:", err);
    } finally {
      userLocalEmitter.off(user.id, onLocalUserEvent);
    }
  });
}
