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
      userLocalEmitter.off(user.id, onLocalUserEvent);
      if (resolveStreamPromise) {
        const resolve = resolveStreamPromise;
        resolveStreamPromise = null;
        resolve();
      }
    };

    // Pure reactive push listener: zero polling, zero latency
    const onLocalUserEvent = async (ev: UserAgentEvent) => {
      if (isClosed || stream.aborted) {
        cleanup();
        return;
      }
      if (
        ev.type === "schedule_updated" ||
        ev.type === "schedule_fired" ||
        ev.type === ("schedules_init" as any)
      ) {
        try {
          await stream.writeSSE({
            event: "schedule",
            data: JSON.stringify(ev),
          });
        } catch {
          cleanup();
        }
      }
    };

    userLocalEmitter.on(user.id, onLocalUserEvent);

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
