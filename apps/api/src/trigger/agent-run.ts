import { db, runs, schedules } from "@openbots/db";
import { schedules as triggerSchedules, task } from "@trigger.dev/sdk";
import { and, eq, inArray } from "drizzle-orm";
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
    const scheduleId = payload?.externalId ?? payload?.scheduleId;
    if (!scheduleId) {
      console.warn("scheduled-agent-task fired without scheduleId or externalId:", payload);
      return;
    }

    // Look up schedule by id or triggerScheduleId
    const [scheduleRecord] = await db
      .select()
      .from(schedules)
      .where(
        payload.externalId
          ? eq(schedules.id, payload.externalId)
          : eq(schedules.triggerScheduleId, scheduleId),
      );

    if (!scheduleRecord) {
      console.warn(`No schedule found in DB for id: ${scheduleId}`);
      return;
    }

    if (scheduleRecord.status !== "active") {
      console.log(`Schedule '${scheduleRecord.name}' (${scheduleRecord.id}) is paused, skipping execution.`);
      return;
    }

    // Create a new run record for this scheduled occurrence
    const [newRun] = await db
      .insert(runs)
      .values({
        userId: scheduleRecord.userId,
        agentId: scheduleRecord.agentId,
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
      throw new Error(`Failed to create run for recurring schedule '${scheduleRecord.name}'`);
    }

    // Execute the run directly
    return await executeAgentRun(newRun.id, { signal: ctx?.signal });
  },
});

