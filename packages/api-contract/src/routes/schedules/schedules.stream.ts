import { getRedis } from "@openbots/db";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";

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

        if (Date.now() - lastPing >= 15000) {
          await stream.writeSSE({ event: "ping", data: "" });
          lastPing = Date.now();
        }

        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    } catch (err) {
      console.warn("Schedules SSE stream closed or interrupted:", err);
    }
  });
}
