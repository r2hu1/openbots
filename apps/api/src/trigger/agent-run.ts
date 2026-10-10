import { agentEventHub } from "@openbots/api-contract";
import { db, runs, schedules } from "@openbots/db";
import { task, schedules as triggerSchedules } from "@trigger.dev/sdk";
import { and, eq, inArray, or } from "drizzle-orm";
import { executeAgentRun } from "../agent/execute.js";

export const agentRunTask = task({
  id: "agent-run",
  retry: {
    maxAttempts: 1, // Runs are managed atomically by database transitions; disable blind retries
  },
  run: async (payload: { runId: string }, { ctx }: { ctx?: any } = {}) => {
    try {
      const result = await executeAgentRun(payload.runId, { signal: ctx?.signal });
      // Explicitly broadcast completion to agent stream in Trigger.dev worker
      if (result && "agentId" in result) {
        agentEventHub.publish(result.agentId, {
          type: "run_status",
          runId: result.id,
          status: result.status,
          output: "output" in result ? result.output : undefined,
          conversationId: result.conversationId ?? null,
        });
      }
      return result;
    } catch (err: any) {
      // Re-fetch run to report failure if failed
      const [failedRun] = await db.select().from(runs).where(eq(runs.id, payload.runId));
      if (failedRun) {
        agentEventHub.publish(failedRun.agentId, {
          type: "run_status",
          runId: failedRun.id,
          status: "failed",
          error: err?.message || "Task failed",
          conversationId: failedRun.conversationId,
        });
      }
      throw err;
    }
  },
  onCancel: async ({ payload }: any) => {
    // If Trigger.dev signals cancellation, ensure DB status transitions to cancelled if still active
    if (!payload?.runId) return;
    const [cancelledRun] = await db
      .update(runs)
      .set({
        status: "cancelled",
        completedAt: new Date(),
      })
      .where(
        and(
          eq(runs.id, payload.runId),
          inArray(runs.status, ["queued", "running"]),
        ),
      )
      .returning();
    if (cancelledRun) {
      agentEventHub.publish(cancelledRun.agentId, {
        type: "run_status",
        runId: cancelledRun.id,
        status: "cancelled",
        conversationId: cancelledRun.conversationId,
      });
    }
  },
});

/**
 * Task executed by Trigger.dev for recurring cron schedules.
 * Receives the schedule payload, finds the active schedule, creates a new run, and executes it.
 */
export const scheduledAgentTask = triggerSchedules.task({
  id: "scheduled-agent-task",
  retry: {
    maxAttempts: 1,
  },
  run: async (payload: any, { ctx }: { ctx?: any } = {}) => {
    const targetId =
      payload?.externalId ??
      payload?.scheduleId ??
      payload?.id ??
      payload?.triggerScheduleId;

    if (!targetId) {
      console.warn(
        "scheduled-agent-task fired without scheduleId or externalId:",
        payload,
      );
      return;
    }

    // Look up schedule by id, triggerScheduleId, or externalId
    let [scheduleRecord] = await db
      .select()
      .from(schedules)
      .where(
        or(
          eq(schedules.id, targetId),
          eq(schedules.triggerScheduleId, targetId),
        ),
      );

    // If still not found by direct ID (e.g., if trigger.dev scheduled task fired for an orphaned schedule ID
    // or externalId was not propagated), attempt matching active schedules
    if (!scheduleRecord) {
      console.warn(
        `No schedule found in DB for id: ${targetId}, checking active schedules...`,
      );
      const activeList = await db
        .select()
        .from(schedules)
        .where(eq(schedules.status, "active"));

      if (activeList.length === 1 && activeList[0]) {
        // Unambiguous single active schedule
        scheduleRecord = activeList[0];
        console.log(
          `Resolved to single active schedule: '${scheduleRecord.name}' (${scheduleRecord.id})`,
        );
      } else {
        console.warn(`Could not resolve schedule for trigger ID: ${targetId}`);
        return;
      }
    }

    if (!scheduleRecord) {
      console.warn(`Schedule record is undefined for ID: ${targetId}`);
      return;
    }

    if (scheduleRecord.status !== "active") {
      console.log(
        `Schedule '${scheduleRecord.name}' (${scheduleRecord.id}) is paused, skipping execution.`,
      );
      return;
    }

    // Create a new run record for this scheduled occurrence
    const [newRun] = await db
      .insert(runs)
      .values({
        userId: scheduleRecord.userId,
        agentId: scheduleRecord.agentId,
        conversationId: scheduleRecord.conversationId ?? null,
        status: "queued",
        triggerType: "schedule",
        input: {
          prompt: scheduleRecord.prompt,
          scheduledTaskName: scheduleRecord.name,
          scheduledFor: new Date().toISOString(),
          recurringScheduleId: scheduleRecord.id,
        },
      })
      .returning();

    if (!newRun) {
      throw new Error(
        `Failed to create run for recurring schedule '${scheduleRecord.name}'`,
      );
    }

    // Execute the run directly and broadcast run_status upon finish
    try {
      const result = await executeAgentRun(newRun.id, { signal: ctx?.signal });
      if (result) {
        agentEventHub.publish(scheduleRecord.agentId, {
          type: "run_status",
          runId: result.id,
          status: result.status,
          output: "output" in result ? result.output : undefined,
          conversationId: "conversationId" in result ? result.conversationId : newRun.conversationId,
        });
      }
      return result;
    } catch (err: any) {
      agentEventHub.publish(scheduleRecord.agentId, {
        type: "run_status",
        runId: newRun.id,
        status: "failed",
        error: err?.message || "Task failed",
        conversationId: newRun.conversationId,
      });
      throw err;
    }
  },
});
