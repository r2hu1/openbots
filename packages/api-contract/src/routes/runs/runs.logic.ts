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
  const [run] = await db
    .select()
    .from(runs)
    .where(and(eq(runs.id, runId), eq(runs.userId, userId)));

  if (!run) {
    return null;
  }

  const steps = await db
    .select()
    .from(runSteps)
    .where(eq(runSteps.runId, runId))
    .orderBy(asc(runSteps.stepNumber));

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
    try {
      await triggerRuns.cancel(runId);
    } catch {
      // Ignore Trigger.dev task cancel errors if not enqueued in Trigger
    }
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
  private eventHistory = new Map<string, RunEvent[]>();
  private redisPollIntervals = new Map<string, any>();

  subscribe(runId: string, listener: RunEventListener): () => void {
    let set = this.localListeners.get(runId);
    if (!set) {
      set = new Set();
      this.localListeners.set(runId, set);
    }
    set.add(listener);

    // Replay any events already emitted for this run in this process
    const history = this.eventHistory.get(runId);
    if (history && history.length > 0) {
      for (const ev of [...history]) {
        try {
          listener(ev);
        } catch {}
      }
    }

    // Only poll Redis if this process is NOT running the executor locally (i.e. separate process)
    const isLocalExecution = this.eventHistory.has(runId);
    if (!isLocalExecution) {
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

          // Immediate check
          pollEvents();
          const interval = setInterval(pollEvents, 100);
          this.redisPollIntervals.set(runId, interval);
        }
      } catch {
        // Redis not configured or error, in-process local listener is active
      }
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

  async publish(runId: string, event: RunEvent): Promise<void> {
    // 0. Cache event in memory history for late-joining subscribers
    let history = this.eventHistory.get(runId);
    if (!history) {
      history = [];
      this.eventHistory.set(runId, history);
      // Clean up in-memory history after 15 minutes
      setTimeout(
        () => {
          this.eventHistory.delete(runId);
        },
        15 * 60 * 1000,
      );
    }
    history.push(event);

    // 1. Dispatch locally to any in-process listeners
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

    // 2. Publish to Redis list so other processes (Next.js server, Trigger worker, API server) receive it
    try {
      const redis = getRedis();
      if (redis) {
        const channelKey = `run_events:${runId}`;
        await redis.rpush(channelKey, JSON.stringify(event));
        // Set 1-hour expiration on event logs to keep Redis tidy
        await redis.expire(channelKey, 3600);
      }
    } catch {
      // Redis not configured or offline; local dispatch was already performed
    }
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
