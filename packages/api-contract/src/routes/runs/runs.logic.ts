import { db, runSteps, runs } from "@openbots/db";
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

// In-process event emitter for real-time SSE streaming between executor and client
type RunEvent =
  | { type: "delta"; text: string }
  | { type: "tool_start"; toolName: string; stepNumber: number }
  | { type: "tool_finish"; toolName: string; stepNumber: number }
  | { type: "status"; status: string; output?: any; error?: string }
  | { type: "done"; status: string; output?: any };

type RunEventListener = (event: RunEvent) => void;

class RunEventHub {
  private listeners = new Map<string, Set<RunEventListener>>();

  subscribe(runId: string, listener: RunEventListener): () => void {
    let set = this.listeners.get(runId);
    if (!set) {
      set = new Set();
      this.listeners.set(runId, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) {
        this.listeners.delete(runId);
      }
    };
  }

  publish(runId: string, event: RunEvent): void {
    const set = this.listeners.get(runId);
    if (set) {
      for (const listener of set) {
        try {
          listener(event);
        } catch (e) {
          console.error("Error in run event listener:", e);
        }
      }
    }
  }
}

export const runEventHub = new RunEventHub();

