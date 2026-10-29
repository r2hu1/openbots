import { db, runs, schedules } from "@openbots/db";
import { and, desc, eq } from "drizzle-orm";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import {
  agentLocalEmitter,
  userLocalEmitter,
  type AgentEvent,
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

    // Hydrate currently active runs so sidebar immediately shows running spinners on refresh
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
      userLocalEmitter.off(user.id, onLocalEvent);
      if (resolveStreamPromise) {
        const resolve = resolveStreamPromise;
        resolveStreamPromise = null;
        resolve();
      }
    };

    // Pure reactive push listener: zero polling, zero latency
    const onLocalEvent = async (ev: UserAgentEvent) => {
      if (isClosed || stream.aborted) {
        cleanup();
        return;
      }
      try {
        await stream.writeSSE({
          event: ev.type,
          data: JSON.stringify(ev),
        });
      } catch {
        cleanup();
      }
    };

    userLocalEmitter.on(user.id, onLocalEvent);

    // Keepalive ping comment every 15s to keep HTTP connection alive
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

    // Hydrate current active schedules
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
      agentLocalEmitter.off(id, onLocalEvent);
      if (resolveStreamPromise) {
        const resolve = resolveStreamPromise;
        resolveStreamPromise = null;
        resolve();
      }
    };

    // Pure reactive push listener: zero polling, zero latency
    const onLocalEvent = async (ev: AgentEvent) => {
      if (isClosed || stream.aborted) {
        cleanup();
        return;
      }
      try {
        await stream.writeSSE({
          event: ev.type,
          data: JSON.stringify(ev),
        });
      } catch {
        cleanup();
      }
    };

    agentLocalEmitter.on(id, onLocalEvent);

    // Keepalive ping comment every 15s to keep HTTP connection alive
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
