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
    // If already terminal, emit current state and exit immediately
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

    // Emit initial status and past steps for hydration
    await stream.writeSSE({
      event: "status",
      data: JSON.stringify({
        status: initial.run.status,
        steps: initial.steps,
      }),
    });

    let isTerminated = false;
    let lastSeenSeq = -1;
    let keepAliveTimer: any = null;
    let resolveStreamPromise: (() => void) | null = null;

    const terminate = () => {
      if (isTerminated) return;
      isTerminated = true;
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
      }
      runLocalEmitter.off(id, onLocalRunEvent);
      if (resolveStreamPromise) {
        const resolve = resolveStreamPromise;
        resolveStreamPromise = null;
        resolve();
      }
    };

    // Pure reactive push listener: zero polling, zero latency
    const onLocalRunEvent = async (ev: RunEvent) => {
      if (isTerminated || stream.aborted) {
        terminate();
        return;
      }

      if (typeof ev.seq === "number") {
        if (ev.seq <= lastSeenSeq) return;
        lastSeenSeq = ev.seq;
      }

      try {
        await stream.writeSSE({
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
          terminate();
        }
      } catch {
        terminate();
      }
    };

    runLocalEmitter.on(id, onLocalRunEvent);

    // Keepalive ping comment every 15 seconds to prevent proxy / load balancer idle timeouts
    keepAliveTimer = setInterval(async () => {
      if (isTerminated || stream.aborted) {
        terminate();
        return;
      }
      try {
        await stream.write(": ping\n\n");
      } catch {
        terminate();
      }
    }, 15_000);

    // Keep stream open until run finishes or client disconnects
    await new Promise<void>((resolve) => {
      resolveStreamPromise = resolve;
      stream.onAbort(() => {
        terminate();
      });
    });
  });
}
