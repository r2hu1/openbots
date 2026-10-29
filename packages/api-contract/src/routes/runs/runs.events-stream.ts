import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import {
  agentLocalEmitter,
  userLocalEmitter,
} from "./runs.events.js";

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

    let isClosed = false;
    let keepAliveTimer: any = null;
    let resolveStreamPromise: (() => void) | null = null;

    const cleanup = () => {
      if (isClosed) return;
      isClosed = true;
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
      }
      if (agentId) {
        agentLocalEmitter.off(agentId, onLocalEvent);
      } else {
        userLocalEmitter.off(user.id, onLocalEvent);
      }
      if (resolveStreamPromise) {
        const resolve = resolveStreamPromise;
        resolveStreamPromise = null;
        resolve();
      }
    };

    // Pure reactive push listener: zero polling, zero latency
    const onLocalEvent = async (ev: any) => {
      if (isClosed || stream.aborted) {
        cleanup();
        return;
      }
      if (ev.type === "run_created" || ev.type === "run_status") {
        try {
          await stream.writeSSE({
            event: ev.type,
            data: JSON.stringify(ev),
          });
        } catch {
          cleanup();
        }
      }
    };

    if (agentId) {
      agentLocalEmitter.on(agentId, onLocalEvent);
    } else {
      userLocalEmitter.on(user.id, onLocalEvent);
    }

    keepAliveTimer = setInterval(async () => {
      if (isClosed || stream.aborted) {
        cleanup();
        return;
      }
      try {
        await stream.write(": ping\n\n");
      } catch {
        cleanup();
      }
    }, 15_000);

    await new Promise<void>((resolve) => {
      resolveStreamPromise = resolve;
      stream.onAbort(() => {
        cleanup();
      });
    });
  });
}
