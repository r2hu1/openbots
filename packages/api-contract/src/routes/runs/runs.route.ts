import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
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
        }),
      });

      const queue: Array<{ event: string; data: string }> = [];
      let notifyResolver: (() => void) | null = null;
      let isDone = false;

      const unsubscribe = runEventHub.subscribe(id, (ev) => {
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
        if (notifyResolver) {
          notifyResolver();
          notifyResolver = null;
        }
      });

      try {
        let lastDbCheck = Date.now();
        while (!stream.aborted) {
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

          if (isDone) {
            break;
          }

          // Periodic DB check every 1500ms as fallback in case worker ran on another process
          if (Date.now() - lastDbCheck > 1500) {
            lastDbCheck = Date.now();
            const current = await getRun(id, user.id);
            if (
              current?.run.status === "completed" ||
              current?.run.status === "failed" ||
              current?.run.status === "cancelled"
            ) {
              await stream.writeSSE({
                event: "status",
                data: JSON.stringify({
                  status: current.run.status,
                  output: current.run.output,
                  error: current.run.error,
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

          if (queue.length === 0 && !isDone) {
            // Wait for next event or 500ms timeout
            await new Promise<void>((resolve) => {
              let timer: any = null;
              const cb = () => {
                if (timer) clearTimeout(timer);
                notifyResolver = null;
                resolve();
              };
              notifyResolver = cb;
              timer = setTimeout(cb, 500);
            });
          }
        }
      } finally {
        unsubscribe();
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
