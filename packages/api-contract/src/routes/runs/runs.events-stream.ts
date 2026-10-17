import { getRedis } from "@openbots/db";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";

type Env = {
  Variables: {
    user: { id: string };
  };
};

export async function handleRunStream(c: Context<Env>) {
  const user = c.get("user");
  const agentId = c.req.query("agentId");

  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache, no-transform");
  c.header("Connection", "keep-alive");
  c.header("X-Accel-Buffering", "no");

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      event: "ready",
      data: JSON.stringify({ userId: user.id, agentId: agentId || null }),
    });

    const queue: Array<{ event: string; data: string }> = [];
    let lastSeenSeq = -1;

    let lastRedisLen = 0;
    const channelKey = agentId
      ? `agent_events:${agentId}`
      : `user_agent_events:${user.id}`;

    try {
      const redis = getRedis();
      if (redis) {
        lastRedisLen = (await redis.llen(channelKey).catch(() => 0)) ?? 0;
      }
    } catch {}

    try {
      let lastPing = Date.now();
      while (!stream.aborted) {
        try {
          const redis = getRedis();
          if (redis) {
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
                  if (
                    parsed.type === "run_created" ||
                    parsed.type === "run_status"
                  ) {
                    queue.push({
                      event: parsed.type,
                      data: typeof raw === "string" ? raw : JSON.stringify(raw),
                    });
                  }
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

        // Ping heartbeat every 10s to keep connection alive
        if (Date.now() - lastPing > 10_000) {
          lastPing = Date.now();
          try {
            await stream.writeSSE({ event: "ping", data: "{}" });
          } catch {}
        }

        await new Promise<void>((resolve) => setTimeout(resolve, 300));
      }
    } finally {
      // Stream closed
    }
  });
}
