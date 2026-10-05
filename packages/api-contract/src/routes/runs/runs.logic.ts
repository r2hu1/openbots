import { db, getRedis, runSteps, runs } from "@openbots/db";
import { runs as triggerRuns } from "@trigger.dev/sdk";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

export async function listRuns(userId: string, agentId?: string) {
  const userRuns = await db
    .select()
    .from(runs)
    .where(
      agentId
        ? and(eq(runs.userId, userId), eq(runs.agentId, agentId))
        : eq(runs.userId, userId),
    )
    .orderBy(desc(runs.createdAt));
  return { runs: userRuns };
}

export async function getRun(runId: string, userId: string) {
  const [[run], steps] = await Promise.all([
    db
      .select()
      .from(runs)
      .where(and(eq(runs.id, runId), eq(runs.userId, userId))),
    db
      .select()
      .from(runSteps)
      .where(eq(runSteps.runId, runId))
      .orderBy(asc(runSteps.stepNumber)),
  ]);

  if (!run) {
    return null;
  }

  return { run, steps };
}

export async function cancelRun(runId: string, userId: string) {
  // Concurrency-safe conditional update: only cancel if run is currently queued or running.
  // Terminal states (completed, failed, cancelled) can NEVER be overwritten.
  const [cancelled] = await db
    .update(runs)
    .set({
      status: "cancelled",
      completedAt: new Date(),
    })
    .where(
      and(
        eq(runs.id, runId),
        eq(runs.userId, userId),
        inArray(runs.status, ["queued", "running"]),
      ),
    )
    .returning();

  if (cancelled) {
    // Fire-and-forget cancellation to Trigger.dev so the user gets an instant 200 response
    triggerRuns.cancel(runId).catch(() => {});
    return { run: cancelled, status: 200 as const };
  }

  // If 0 rows updated, verify whether run exists and return current terminal state
  const [existingRun] = await db
    .select()
    .from(runs)
    .where(and(eq(runs.id, runId), eq(runs.userId, userId)));

  if (!existingRun) {
    return { error: "Run not found", status: 404 as const };
  }

  // Already terminal (completed, failed, cancelled) - safely return without mutating
  return { run: existingRun, status: 200 as const };
}

// Cross-process event emitter using Upstash Redis Pub/Sub with in-memory fallback
export type RunEvent =
  | { seq?: number; type: "delta"; text: string }
  | {
      seq?: number;
      type: "tool_start";
      toolName: string;
      stepNumber: number;
    }
  | {
      seq?: number;
      type: "tool_finish";
      toolName: string;
      stepNumber: number;
    }
  | {
      seq?: number;
      type: "status";
      status: string;
      output?: any;
      error?: string;
      steps?: any[];
    }
  | { seq?: number; type: "done"; status: string; output?: any };

type RunEventListener = (event: RunEvent) => void;

class RunEventHub {
  private localListeners = new Map<string, Set<RunEventListener>>();
  private inMemoryBuffers = new Map<string, RunEvent[]>();
  private nextSeq = 0;

  subscribe(runId: string, listener: RunEventListener): () => void {
    let lastSeenSeq = -1;
    const safeListener: RunEventListener = (ev) => {
      if (ev.seq !== undefined) {
        if (ev.seq <= lastSeenSeq) return;
        lastSeenSeq = ev.seq;
      }
      listener(ev);
    };

    let set = this.localListeners.get(runId);
    if (!set) {
      set = new Set();
      this.localListeners.set(runId, set);
    }
    set.add(safeListener);

    // Replay in-memory events for late-joining subscribers
    const buffered = this.inMemoryBuffers.get(runId);
    if (buffered && buffered.length > 0) {
      for (const ev of buffered) {
        try {
          safeListener(ev);
        } catch {}
      }
    }

    // One-time initial replay of stored events from Redis for late-joining subscribers
    try {
      const redis = getRedis();
      if (redis) {
        const channelKey = `run_events:${runId}`;
        redis
          .lrange(channelKey, 0, -1)
          .then((items) => {
            if (items && items.length > 0) {
              for (const item of items) {
                const parsed: RunEvent =
                  typeof item === "string" ? JSON.parse(item) : item;
                safeListener(parsed);
              }
            }
          })
          .catch(() => {});
      }
    } catch {
      // Redis not configured, fallback to in-process dispatch
    }

    return () => {
      set?.delete(safeListener);
      if (set && set.size === 0) {
        this.localListeners.delete(runId);
      }
    };
  }

  publish(runId: string, event: RunEvent): void {
    const eventWithSeq: RunEvent = {
      ...event,
      seq: event.seq ?? this.nextSeq++,
    };

    // 1. Buffer for immediate late-joining subscribers in-memory
    let buffer = this.inMemoryBuffers.get(runId);
    if (!buffer) {
      buffer = [];
      this.inMemoryBuffers.set(runId, buffer);
    }
    buffer.push(eventWithSeq);

    if (
      eventWithSeq.type === "done" ||
      (eventWithSeq.type === "status" &&
        (eventWithSeq.status === "completed" ||
          eventWithSeq.status === "failed" ||
          eventWithSeq.status === "cancelled"))
    ) {
      setTimeout(() => {
        this.inMemoryBuffers.delete(runId);
      }, 60_000);
    }

    // 2. Dispatch immediately to in-process listeners with 0ms latency
    const set = this.localListeners.get(runId);
    if (set) {
      for (const listener of set) {
        try {
          listener(eventWithSeq);
        } catch (e) {
          console.error("Error in run event listener:", e);
        }
      }
    }

    // 3. Fire-and-forget pipeline to Redis list for cross-process subscribers without blocking execution
    try {
      const redis = getRedis();
      if (redis) {
        const channelKey = `run_events:${runId}`;
        const serialized = JSON.stringify(eventWithSeq);
        redis
          .rpush(channelKey, serialized)
          .then(() => redis.expire(channelKey, 3600))
          .catch(() => {});
      }
    } catch {}
  }
}

export const runEventHub = new RunEventHub();

export type AgentEvent =
  | { seq?: number; type: "run_created"; run: any }
  | {
      seq?: number;
      type: "run_status";
      runId: string;
      status: string;
      error?: string;
      output?: any;
    }
  | {
      seq?: number;
      type: "schedule_fired";
      scheduleId?: string;
      runId: string;
      name?: string;
      prompt?: string;
      conversationId?: string | null;
    }
  | {
      seq?: number;
      type: "schedule_updated";
      scheduleId: string;
      action: "created" | "updated" | "deleted";
    };

type AgentEventListener = (event: AgentEvent) => void;

class AgentEventHub {
  private localListeners = new Map<string, Set<AgentEventListener>>();
  private inMemoryBuffers = new Map<string, AgentEvent[]>();
  private nextSeq = 0;

  subscribe(agentId: string, listener: AgentEventListener): () => void {
    let lastSeenSeq = -1;
    const safeListener: AgentEventListener = (ev) => {
      if (ev.seq !== undefined) {
        if (ev.seq <= lastSeenSeq) return;
        lastSeenSeq = ev.seq;
      }
      listener(ev);
    };

    let set = this.localListeners.get(agentId);
    if (!set) {
      set = new Set();
      this.localListeners.set(agentId, set);
    }
    set.add(safeListener);

    // Replay recent in-memory events
    const buffered = this.inMemoryBuffers.get(agentId);
    if (buffered && buffered.length > 0) {
      for (const ev of buffered) {
        try {
          safeListener(ev);
        } catch {}
      }
    }

    try {
      const redis = getRedis();
      if (redis) {
        const channelKey = `agent_events:${agentId}`;
        redis
          .lrange(channelKey, 0, -1)
          .then((items) => {
            if (items && items.length > 0) {
              for (const item of items) {
                const parsed: AgentEvent =
                  typeof item === "string" ? JSON.parse(item) : item;
                safeListener(parsed);
              }
            }
          })
          .catch(() => {});
      }
    } catch {}

    return () => {
      set?.delete(safeListener);
      if (set && set.size === 0) {
        this.localListeners.delete(agentId);
      }
    };
  }

  publish(agentId: string, event: AgentEvent): void {
    const eventWithSeq: AgentEvent = {
      ...event,
      seq: event.seq ?? this.nextSeq++,
    };

    let buffer = this.inMemoryBuffers.get(agentId);
    if (!buffer) {
      buffer = [];
      this.inMemoryBuffers.set(agentId, buffer);
    }
    buffer.push(eventWithSeq);
    if (buffer.length > 30) {
      buffer.shift();
    }

    const set = this.localListeners.get(agentId);
    if (set) {
      for (const listener of set) {
        try {
          listener(eventWithSeq);
        } catch (e) {
          console.error("Error in agent event listener:", e);
        }
      }
    }

    try {
      const redis = getRedis();
      if (redis) {
        const channelKey = `agent_events:${agentId}`;
        const serialized = JSON.stringify(eventWithSeq);
        redis
          .rpush(channelKey, serialized)
          .then(() => redis.expire(channelKey, 1800))
          .catch(() => {});
      }
    } catch {}
  }
}

export const agentEventHub = new AgentEventHub();

export type DirectRunExecutor = (runId: string) => Promise<any>;
let directRunExecutor: DirectRunExecutor | null = null;

export function registerDirectRunExecutor(executor: DirectRunExecutor) {
  directRunExecutor = executor;
}

export function getDirectRunExecutor(): DirectRunExecutor | null {
  return directRunExecutor;
}
