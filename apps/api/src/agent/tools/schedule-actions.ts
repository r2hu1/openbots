import { agentEventHub } from "@openbots/api-contract";
import { db, runs, schedules } from "@openbots/db";
import {
  runs as triggerRuns,
  schedules as triggerSchedules,
} from "@trigger.dev/sdk";
import { and, eq } from "drizzle-orm";

export async function handleCancelAction(
  userId: string,
  agentId: string,
  taskId?: string,
  searchTarget?: string,
) {
  if (taskId) {
    const [cancelledRun] = await db
      .update(runs)
      .set({ status: "cancelled", completedAt: new Date() })
      .where(and(eq(runs.id, taskId), eq(runs.userId, userId), eq(runs.status, "queued")))
      .returning();

    if (cancelledRun) {
      try {
        await triggerRuns.cancel(taskId);
      } catch {}
      const inp = (cancelledRun.input as any) ?? {};
      agentEventHub.publish(agentId, {
        type: "schedule_updated",
        scheduleId: cancelledRun.id,
        action: "deleted",
      });
      return {
        success: true,
        type: "delayed_reminder",
        cancelledId: cancelledRun.id,
        name: inp.scheduledTaskName ?? "Reminder",
        message: `Queued reminder '${inp.scheduledTaskName ?? taskId}' has been successfully cancelled.`,
      };
    }

    const [deletedSchedule] = await db
      .delete(schedules)
      .where(and(eq(schedules.id, taskId), eq(schedules.userId, userId)))
      .returning();

    if (deletedSchedule) {
      if (deletedSchedule.triggerScheduleId) {
        triggerSchedules.del(deletedSchedule.triggerScheduleId).catch(() => {});
      }
      agentEventHub.publish(agentId, {
        type: "schedule_updated",
        scheduleId: deletedSchedule.id,
        action: "deleted",
      });
      return {
        success: true,
        type: "recurring_schedule",
        cancelledId: deletedSchedule.id,
        name: deletedSchedule.name,
        message: `Recurring schedule '${deletedSchedule.name}' has been successfully deleted/cancelled.`,
      };
    }
  }

  const normalize = (s?: string | null) => (s ?? "").trim().toLowerCase();
  if (searchTarget) {
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

    const matchedRun = queuedRuns.find((r) => {
      const inp = (r.input as any) ?? {};
      const name = normalize(inp.scheduledTaskName);
      const prompt = normalize(inp.prompt);
      return (
        name.includes(searchTarget) ||
        searchTarget.includes(name) ||
        prompt.includes(searchTarget)
      );
    });

    if (matchedRun) {
      await db
        .update(runs)
        .set({ status: "cancelled", completedAt: new Date() })
        .where(eq(runs.id, matchedRun.id));

      try {
        await triggerRuns.cancel(matchedRun.id);
      } catch {}

      const inp = (matchedRun.input as any) ?? {};
      agentEventHub.publish(agentId, {
        type: "schedule_updated",
        scheduleId: matchedRun.id,
        action: "deleted",
      });
      return {
        success: true,
        type: "delayed_reminder",
        cancelledId: matchedRun.id,
        name: inp.scheduledTaskName ?? "Reminder",
        message: `Queued reminder '${inp.scheduledTaskName ?? searchTarget}' has been successfully cancelled.`,
      };
    }

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

    const matchedSchedule = activeSchedules.find((s) => {
      const name = normalize(s.name);
      const prompt = normalize(s.prompt);
      return (
        name.includes(searchTarget) ||
        searchTarget.includes(name) ||
        prompt.includes(searchTarget)
      );
    });

    if (matchedSchedule) {
      if (matchedSchedule.triggerScheduleId) {
        triggerSchedules.del(matchedSchedule.triggerScheduleId).catch(() => {});
      }
      await db.delete(schedules).where(eq(schedules.id, matchedSchedule.id));

      agentEventHub.publish(agentId, {
        type: "schedule_updated",
        scheduleId: matchedSchedule.id,
        action: "deleted",
      });
      return {
        success: true,
        type: "recurring_schedule",
        cancelledId: matchedSchedule.id,
        name: matchedSchedule.name,
        message: `Recurring schedule '${matchedSchedule.name}' has been successfully cancelled.`,
      };
    }
  }

  return {
    success: false,
    error: `Could not find any active reminder or schedule matching '${taskId ?? searchTarget}'. Call with action 'list' to see all active tasks.`,
  };
}
