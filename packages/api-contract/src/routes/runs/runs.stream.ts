import { getRedis } from "@openbots/db";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { runLocalEmitter, type RunEvent } from "./runs.events.js";
import { getRun } from "./runs.logic.js";

type Env = {
  Variables: {
    user: { id: string };
  };
};

export async function handleSingleRunStream(c: Context<Env>) {
  const user = c.get("user");
  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "Missing run id" }, 400);
  }
  const initial = await getRun(id, user.id);
  if (!initial) {
    return c.json({ error: "Run not found" }, 404);
  }

  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache, no-transform");
  c.header("Connection", "keep-alive");
  c.header("X-Accel-Buffering", "no");

  return streamSSE(c, async (stream) => {
    // If already terminal, emit current state and exit
    if (
      initial.run.status === "completed" ||
      initial.run.status === "failed" ||
      initial.run.status === "cancelled"
    ) {
      await stream.writeSSE({
        event: "status",
        data: JSON.stringify({
          status: initial.run.status,
          output: initial.run.output,
          error: initial.run.error,
          steps: initial.steps,
        }),
      });
      await stream.writeSSE({
        event: "done",
        data: JSON.stringify({
          status: initial.run.status,
          output: initial.run.output,
        }),
      });
      return;
    }

    // Initial status
    await stream.writeSSE({
      event: "status",
      data: JSON.stringify({
        status: initial.run.status,
        steps: initial.steps,
      }),
    });

    const queue: Array<{ event: string; data: string }> = [];
    let isDone = false;
    let lastSeenSeq = -1;

    // Process-local listener for zero latency delivery
    const onLocalRunEvent = (ev: RunEvent) => {
      queue.push({
        event: ev.type,
        data: JSON.stringify(ev),
      });
      if (
        ev.type === "done" ||
        (ev.type === "status" &&
          (ev.status === "completed" ||
            ev.status === "failed" ||
            ev.status === "cancelled"))
      ) {
        isDone = true;
      }
    };
    runLocalEmitter.on(id, onLocalRunEvent);

    let lastRedisLen = 0;
    try {
      const redis = getRedis();
      if (redis) {
        lastRedisLen = 0; // Read all past events for this run to hydrate client
      }
    } catch {}

    try {
      let lastDbCheck = Date.now();
      let lastPing = Date.now();
      while (!stream.aborted) {
        let hadNewEvents = false;
        if (queue.length > 0) {
          const item = queue.shift()!;
          await stream.writeSSE({
            event: item.event,
            data: item.data,
          });
          if (item.event === "done") {
            break;
          }
          continue;
        }

        if (isDone && queue.length === 0) {
          break;
        }

        // Check cross-process events from Redis (dispatched by Trigger.dev or worker processes)
        try {
          const redis = getRedis();
          if (redis) {
            const channelKey = `run_events:${id}`;
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
                hadNewEvents = true;
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
                  if (
                    parsed.type === "done" ||
                    (parsed.type === "status" &&
                      (parsed.status === "completed" ||
                        parsed.status === "failed" ||
                        parsed.status === "cancelled"))
                  ) {
                    isDone = true;
                  }
                }
                if (queue.length > 0) continue;
              }
            }
          }
        } catch {}

        // Fallback DB check every 2.5s: if run is already terminal in database, send terminal state and exit
        if (Date.now() - lastDbCheck > 2_500) {
          lastDbCheck = Date.now();
          const current = await getRun(id, user.id);
          if (
            current &&
            (current.run.status === "completed" ||
              current.run.status === "failed" ||
              current.run.status === "cancelled")
          ) {
            await stream.writeSSE({
              event: "status",
              data: JSON.stringify({
                status: current.run.status,
                output: current.run.output,
                error: current.run.error,
                steps: current.steps,
              }),
            });
            await stream.writeSSE({
              event: "done",
              data: JSON.stringify({
                status: current.run.status,
                output: current.run.output,
              }),
            });
            break;
          }
        }

        // Send keep-alive ping comment every 10 seconds to keep connection alive across proxies
        if (Date.now() - lastPing > 10_000) {
          lastPing = Date.now();
          try {
            await stream.write(": ping\n\n");
          } catch {
            break;
          }
        }

        if (queue.length === 0 && !isDone) {
          const waitMs = hadNewEvents ? 30 : 60;
          await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
        }
      }
    } finally {
      runLocalEmitter.off(id, onLocalRunEvent);
    }
  });
}
