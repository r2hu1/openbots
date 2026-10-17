import {
  agentEventHub,
  normalizeTriggerTimezone,
} from "@openbots/api-contract";
import { db, runs, schedules } from "@openbots/db";
import {
  tasks,
  runs as triggerRuns,
  schedules as triggerSchedules,
} from "@trigger.dev/sdk";
import { and, eq } from "drizzle-orm";

export async function handleModifyAction(params: {
  userId: string;
  agentId: string;
  taskId?: string;
  searchTarget: string;
  newName?: string;
  newPrompt?: string;
  delaySeconds?: number;
  runAt?: string;
  cronExpression?: string;
  timezone?: string;
}) {
  const {
    userId,
    agentId,
    taskId,
    searchTarget,
    newName,
    newPrompt,
    delaySeconds,
    runAt,
    cronExpression,
    timezone,
  } = params;
  let targetRun: typeof runs.$inferSelect | undefined;
  let targetSchedule: typeof schedules.$inferSelect | undefined;

  if (taskId) {
    const [foundRun] = await db
      .select()
      .from(runs)
      .where(and(eq(runs.id, taskId), eq(runs.userId, userId), eq(runs.status, "queued")));
    if (foundRun) {
      targetRun = foundRun;
    } else {
      const [foundSchedule] = await db
        .select()
        .from(schedules)
        .where(and(eq(schedules.id, taskId), eq(schedules.userId, userId), eq(schedules.status, "active")));
      if (foundSchedule) targetSchedule = foundSchedule;
    }
  }

  const normalize = (s?: string | null) => (s ?? "").trim().toLowerCase();
  if (!targetRun && !targetSchedule && searchTarget) {
    const queuedRuns = await db
      .select()
      .from(runs)
      .where(
        and(
          eq(runs.userId, userId),
          eq(runs.agentId, agentId),
          eq(runs.status, "queued"),
          eq(runs.triggerType, "schedule"),
        ),
      );

    targetRun = queuedRuns.find((r) => {
      const inp = (r.input as any) ?? {};
      const name = normalize(inp.scheduledTaskName);
      const prompt = normalize(inp.prompt);
      return (
        name.includes(searchTarget) ||
        searchTarget.includes(name) ||
        prompt.includes(searchTarget)
      );
    });

    if (!targetRun) {
      const activeSchedules = await db
        .select()
        .from(schedules)
        .where(
          and(
            eq(schedules.userId, userId),
            eq(schedules.agentId, agentId),
            eq(schedules.status, "active"),
          ),
        );

      targetSchedule = activeSchedules.find((s) => {
        const name = normalize(s.name);
        const prompt = normalize(s.prompt);
        return (
          name.includes(searchTarget) ||
          searchTarget.includes(name) ||
          prompt.includes(searchTarget)
        );
      });
    }
  }

  if (!targetRun && !targetSchedule) {
    return {
      success: false,
      error: `Could not find an active task matching '${taskId ?? searchTarget}' to modify. Call with action 'list' to view available tasks.`,
    };
  }

  if (targetRun) {
    const oldInput = (targetRun.input as any) ?? {};
    let computedDelaySeconds = delaySeconds;

    if (runAt) {
      const targetTime = new Date(runAt).getTime();
      const now = Date.now();
      computedDelaySeconds = Math.max(1, Math.round((targetTime - now) / 1000));
    }

    const updatedName = newName ?? oldInput.scheduledTaskName ?? "Reminder";
    const updatedPrompt = newPrompt ?? oldInput.prompt ?? "";
    const updatedScheduledFor = computedDelaySeconds
      ? new Date(Date.now() + computedDelaySeconds * 1000).toISOString()
      : (oldInput.scheduledFor ?? new Date().toISOString());

    const newInput = {
      ...oldInput,
      scheduledTaskName: updatedName,
      prompt: updatedPrompt,
      scheduledFor: updatedScheduledFor,
    };

    if (computedDelaySeconds && computedDelaySeconds > 0) {
      try {
        await triggerRuns.cancel(targetRun.id);
      } catch {}

      try {
        await tasks.trigger(
          "agent-run",
          { runId: targetRun.id },
          {
            delay: `${computedDelaySeconds}s`,
            idempotencyKey: `${targetRun.id}-${Date.now()}`,
            tags: [targetRun.id, userId],
          },
        );
      } catch (triggerErr) {
        console.warn("Could not dispatch modified Trigger.dev task:", triggerErr);
      }
    }

    await db
      .update(runs)
      .set({ input: newInput })
      .where(eq(runs.id, targetRun.id));

    agentEventHub.publish(agentId, {
      type: "schedule_updated",
      scheduleId: targetRun.id,
      action: "updated",
    });

    return {
      success: true,
      type: "delayed_reminder",
      taskId: targetRun.id,
      name: updatedName,
      prompt: updatedPrompt,
      scheduledFor: updatedScheduledFor,
      message: `Reminder '${updatedName}' has been updated successfully.`,
    };
  }

  if (targetSchedule) {
    const updatedName = newName ?? targetSchedule.name;
    const updatedPrompt = newPrompt ?? targetSchedule.prompt;
    const updatedCron = cronExpression ?? targetSchedule.cronExpression;
    const updatedTz = timezone
      ? normalizeTriggerTimezone(timezone)
      : targetSchedule.timezone;

    await db
      .update(schedules)
      .set({
        name: updatedName,
        prompt: updatedPrompt,
        cronExpression: updatedCron,
        timezone: updatedTz,
        updatedAt: new Date(),
      })
      .where(eq(schedules.id, targetSchedule.id));

    agentEventHub.publish(agentId, {
      type: "schedule_updated",
      scheduleId: targetSchedule.id,
      action: "updated",
    });

    if (targetSchedule.triggerScheduleId && (cronExpression || timezone)) {
      triggerSchedules
        .update(targetSchedule.triggerScheduleId, {
          task: "scheduled-agent-task",
          cron: updatedCron,
          timezone: updatedTz,
        })
        .catch(() => {});
    }

    return {
      success: true,
      type: "recurring_schedule",
      scheduleId: targetSchedule.id,
      name: updatedName,
      cronExpression: updatedCron,
      timezone: updatedTz,
      message: `Recurring schedule '${updatedName}' has been updated to cron '${updatedCron}' (${updatedTz}).`,
    };
  }

  return { success: false, error: "Modification failed" };
}
