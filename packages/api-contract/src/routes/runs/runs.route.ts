import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { getRedis } from "@openbots/db";
import { authMiddleware } from "../../middleware/auth.js";
import { cancelRun, getRun, listRuns, runEventHub } from "./runs.logic.js";

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
  .get("/:id", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const result = await getRun(id, user.id);
    if (!result) {
      return c.json({ error: "Run not found" }, 404);
    }
    return c.json(result);
  })
  .get("/:id/stream", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
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

      let lastRedisLen = 0;
      try {
        const redis = getRedis();
        if (redis) {
          const channelKey = `run_events:${id}`;
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
                      data:
                        typeof raw === "string" ? raw : JSON.stringify(raw),
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
            // Poll Redis with low latency (50ms) during active runs, adaptively backing off
            const waitMs = hadNewEvents ? 30 : 60;
            await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
          }
        }
      } finally {
        // Stream closed
      }
    });
  })
  .post("/:id/cancel", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const result = await cancelRun(id, user.id);
    if ("error" in result) {
      return c.json({ error: result.error }, result.status);
    }
    return c.json({ run: result.run });
  });
