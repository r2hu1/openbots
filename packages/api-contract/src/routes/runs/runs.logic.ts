import { db, getRedis, messages, runSteps, runs } from "@openbots/db";
import { runs as triggerRuns } from "@trigger.dev/sdk";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  agentEventHub,
  getDirectRunCanceller,
} from "./runs.events.js";

export * from "./runs.events.js";

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
  const stopMessageText = "Execution stopped by user.";

  const [cancelled] = await db
    .update(runs)
    .set({
      status: "cancelled",
      output: { text: stopMessageText },
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
    // 0. If run has an active conversation, insert a clear assistant message indicating it was stopped
    if (cancelled.conversationId) {
      try {
        await db.insert(messages).values({
          conversationId: cancelled.conversationId,
          role: "assistant",
          content: { text: stopMessageText },
        });
      } catch (msgErr) {
        console.warn("Failed to insert cancellation message:", msgErr);
      }
    }
    // 1. Abort local running process immediately if active on this worker
    try {
      getDirectRunCanceller()?.(runId, "Run cancelled by user");
    } catch {}

    // 2. Broadcast cancellation event and fast lookup key over Redis so any worker instance running this job aborts
    try {
      const redis = getRedis();
      if (redis) {
        const channelKey = `run_events:${runId}`;
        const cancelEvent = {
          type: "status",
          status: "cancelled",
          output: { text: stopMessageText },
        };
        const cancelFlagKey = `run_cancelled:${runId}`;
        await Promise.allSettled([
          redis.set(cancelFlagKey, "1", { ex: 3600 }),
          redis
            .rpush(channelKey, JSON.stringify(cancelEvent))
            .then(() => redis.expire(channelKey, 3600)),
        ]);
        if (cancelled.agentId) {
          agentEventHub.publish(
            cancelled.agentId,
            {
              type: "run_status",
              runId,
              status: "cancelled",
              output: { text: stopMessageText },
              conversationId: cancelled.conversationId,
            },
            userId,
          );
        }
      }
    } catch {}

    // 3. Fire-and-forget cancellation to Trigger.dev for serverless task workers
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
