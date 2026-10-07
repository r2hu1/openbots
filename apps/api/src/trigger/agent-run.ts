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
    return await executeAgentRun(payload.runId, { signal: ctx?.signal });
  },
  onCancel: async ({ payload }: any) => {
    // If Trigger.dev signals cancellation, ensure DB status transitions to cancelled if still active
    if (!payload?.runId) return;
    await db
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
      );
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

    // Execute the run directly (executeAgentRun publishes schedule_fired and runs the agent)
    return await executeAgentRun(newRun.id, { signal: ctx?.signal });
  },
});
