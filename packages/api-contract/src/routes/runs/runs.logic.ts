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
    // 1. Abort local running process immediately if active on this worker
    try {
      directRunCanceller?.(runId, "Run cancelled by user");
    } catch {}

    // 2. Broadcast cancellation event and fast lookup key over Redis so any worker instance running this job aborts
    try {
      const redis = getRedis();
      if (redis) {
        const channelKey = `run_events:${runId}`;
        const cancelEvent = {
          type: "status",
          status: "cancelled",
        };
        const cancelFlagKey = `run_cancelled:${runId}`;
        await Promise.allSettled([
          redis.set(cancelFlagKey, "1", { ex: 3600 }),
          redis.rpush(channelKey, JSON.stringify(cancelEvent)).then(() => redis.expire(channelKey, 3600)),
        ]);
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

// Cross-process event publisher using Redis for scale
export type RunEvent =
  | { seq?: number; type: "delta"; text: string }
  | {
      seq?: number;
      type: "tool_start";
      toolName: string;
      toolCallId?: string;
      stepNumber?: number;
      input?: any;
    }
  | {
      seq?: number;
      type: "tool_finish";
      toolName: string;
      toolCallId?: string;
      stepNumber?: number;
      input?: any;
      output?: any;
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

class RunEventHub {
  publish(runId: string, event: RunEvent): void {
    const redis = getRedis();
    if (!redis) return;

    const channelKey = `run_events:${runId}`;
    const seqKey = `run_events_seq:${runId}`;

    redis
      .incr(seqKey)
      .then((seq) => {
        const eventWithSeq: RunEvent = {
          ...event,
          seq,
        };
        const serialized = JSON.stringify(eventWithSeq);
        return Promise.allSettled([
          redis.expire(seqKey, 3600),
          redis.rpush(channelKey, serialized).then(() => redis.expire(channelKey, 3600)),
        ]);
      })
      .catch((err) => {
        console.error("Failed to publish run event to Redis:", err);
      });
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
      conversationId?: string | null;
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
    }
  | {
      seq?: number;
      type: "agent_updated";
      agentId: string;
      status?: string;
      lastMessage?: string | null;
      runId?: string;
    };

export type UserAgentEvent = AgentEvent & { agentId: string };

class AgentEventHub {
  publishUser(userId: string, event: UserAgentEvent): void {
    const redis = getRedis();
    if (!redis) return;

    const channelKey = `user_agent_events:${userId}`;
    const seqKey = `user_agent_events_seq:${userId}`;

    redis
      .incr(seqKey)
      .then((seq) => {
        const eventWithSeq: UserAgentEvent = {
          ...event,
          seq,
        };
        const serialized = JSON.stringify(eventWithSeq);
        return Promise.allSettled([
          redis.expire(seqKey, 1800),
          redis.rpush(channelKey, serialized).then(() => redis.expire(channelKey, 1800)),
        ]);
      })
      .catch((err) => {
        console.error("Failed to publish user event to Redis:", err);
      });
  }

  publish(agentId: string, event: AgentEvent, userId?: string): void {
    const redis = getRedis();

    if (redis) {
      const channelKey = `agent_events:${agentId}`;
      const seqKey = `agent_events_seq:${agentId}`;

      redis
        .incr(seqKey)
        .then((seq) => {
          const eventWithSeq: AgentEvent = {
            ...event,
            seq,
          };
          const serialized = JSON.stringify(eventWithSeq);
          return Promise.allSettled([
            redis.expire(seqKey, 1800),
            redis.rpush(channelKey, serialized).then(() => redis.expire(channelKey, 1800)),
          ]);
        })
        .catch((err) => {
          console.error("Failed to publish agent event to Redis:", err);
        });
    }

    if (userId) {
      this.publishUser(userId, { ...event, agentId });
    }
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

export type DirectRunCanceller = (runId: string, reason?: string) => void;
let directRunCanceller: DirectRunCanceller | null = null;

export function registerDirectRunCanceller(canceller: DirectRunCanceller) {
  directRunCanceller = canceller;
}

export function getDirectRunCanceller(): DirectRunCanceller | null {
  return directRunCanceller;
}
