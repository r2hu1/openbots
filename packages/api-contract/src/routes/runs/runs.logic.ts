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
  | { type: "delta"; text: string }
  | { type: "tool_start"; toolName: string; stepNumber: number }
  | { type: "tool_finish"; toolName: string; stepNumber: number }
  | { type: "status"; status: string; output?: any; error?: string }
  | { type: "done"; status: string; output?: any };

type RunEventListener = (event: RunEvent) => void;

class RunEventHub {
  private localListeners = new Map<string, Set<RunEventListener>>();
  private redisPollIntervals = new Map<string, any>();

  subscribe(runId: string, listener: RunEventListener): () => void {
    let set = this.localListeners.get(runId);
    if (!set) {
      set = new Set();
      this.localListeners.set(runId, set);
    }
    set.add(listener);

    // Sync from Redis list for both late-joining replay and cross-process streaming
    try {
      const redis = getRedis();
      if (redis && !this.redisPollIntervals.has(runId)) {
        let lastLength = 0;
        const channelKey = `run_events:${runId}`;

        const pollEvents = async () => {
          try {
            const currentLen = await redis.llen(channelKey);
            if (currentLen > lastLength) {
              const newItems = await redis.lrange(
                channelKey,
                lastLength,
                currentLen - 1,
              );
              lastLength = currentLen;
              for (const item of newItems) {
                const parsed: RunEvent =
                  typeof item === "string" ? JSON.parse(item) : item;
                const activeSet = this.localListeners.get(runId);
                if (activeSet) {
                  for (const l of activeSet) {
                    try {
                      l(parsed);
                    } catch {}
                  }
                }
              }
            }
          } catch {
            // Ignore Redis poll errors
          }
        };

        // Immediate check to replay all events stored in Redis
        pollEvents();
        const interval = setInterval(pollEvents, 100);
        this.redisPollIntervals.set(runId, interval);
      }
    } catch {
      // Redis not configured, fallback to in-process dispatch
    }

    return () => {
      set?.delete(listener);
      if (set && set.size === 0) {
        this.localListeners.delete(runId);
        const poll = this.redisPollIntervals.get(runId);
        if (poll) {
          clearInterval(poll);
          this.redisPollIntervals.delete(runId);
        }
      }
    };
  }

  publish(runId: string, event: RunEvent): void {
    // 1. Dispatch immediately to in-process listeners with 0ms latency
    const set = this.localListeners.get(runId);
    if (set) {
      for (const listener of set) {
        try {
          listener(event);
        } catch (e) {
          console.error("Error in run event listener:", e);
        }
      }
    }

    // 2. Fire-and-forget pipeline to Redis list for cross-process subscribers without blocking execution
    try {
      const redis = getRedis();
      if (redis) {
        const channelKey = `run_events:${runId}`;
        const serialized = JSON.stringify(event);
        redis.rpush(channelKey, serialized)
          .then(() => redis.expire(channelKey, 3600))
          .catch(() => {});
      }
    } catch {}
  }
}

export const runEventHub = new RunEventHub();

export type DirectRunExecutor = (runId: string) => Promise<any>;
let directRunExecutor: DirectRunExecutor | null = null;

export function registerDirectRunExecutor(executor: DirectRunExecutor) {
  directRunExecutor = executor;
}

export function getDirectRunExecutor(): DirectRunExecutor | null {
  return directRunExecutor;
}
