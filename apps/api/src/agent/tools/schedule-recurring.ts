import {
  agentEventHub,
  normalizeTriggerTimezone,
} from "@openbots/api-contract";
import { db, schedules } from "@openbots/db";
import {
  schedules as triggerSchedules,
} from "@trigger.dev/sdk";
import { tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
export { getTaskHistoryTool } from "./schedule-history.js";

export function createRecurringTaskTool(
  userId: string,
  agentId: string,
  conversationId?: string | null,
) {
  return tool({
    description:
      "Create a repeating or recurring scheduled task / cron job for this agent. " +
      "Use this whenever the user wants an instruction, report, check, or action to repeat automatically on a regular schedule " +
      "(e.g. 'every day at 9am', 'every Monday morning', 'every 2 hours', 'every weekday at 5pm', 'daily crypto check', 'weekly summary'). " +
      "Supports friendly frequency presets or standard 5-field cron expressions.",
    inputSchema: z.object({
      name: z
        .string()
        .describe(
          "A descriptive title for the recurring task (e.g. 'Daily Crypto Summary', 'Hourly Site Health Check')",
        ),
      prompt: z
        .string()
        .describe(
          "The exact instruction or task for the agent to execute each time the schedule triggers",
        ),
      frequency: z
        .enum(["hourly", "daily", "weekdays", "weekly", "monthly", "custom"])
        .default("daily")
        .describe(
          "Schedule frequency: 'hourly' (at minute 0), 'daily' (once a day), 'weekdays' (Monday to Friday), 'weekly' (once a week on a chosen day), 'monthly' (1st of month), or 'custom' (uses cronExpression)",
        ),
      cronExpression: z
        .string()
        .optional()
        .describe(
          "A standard 5-field cron expression (e.g. '0 9 * * *' for 9am daily, '*/30 * * * *' for every 30 mins). If provided, takes precedence over frequency.",
        ),
      timeOfDay: z
        .string()
        .optional()
        .describe(
          "Time of day to run in 24h 'HH:MM' format (e.g. '09:00' for 9am, '18:30' for 6:30pm). Defaults to '09:00' for daily/weekdays/weekly.",
        ),
      dayOfWeek: z
        .enum([
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ])
        .optional()
        .describe("Day of week when frequency is 'weekly' (e.g. 'monday')"),
      timezone: z
        .string()
        .optional()
        .describe(
          "IANA timezone for the schedule (e.g. 'America/New_York', 'Asia/Kolkata', 'UTC'). Defaults to UTC.",
        ),
    }),
    execute: async ({
      name,
      prompt,
      frequency,
      cronExpression,
      timeOfDay,
      dayOfWeek,
      timezone = "UTC",
    }) => {
      let cron = cronExpression;
      if (!cron) {
        let hour = 9;
        let minute = 0;
        if (timeOfDay) {
          const parts = timeOfDay.split(":");
          const h = parseInt(parts[0] ?? "", 10);
          const m = parseInt(parts[1] ?? "", 10);
          if (!isNaN(h) && h >= 0 && h <= 23) hour = h;
          if (!isNaN(m) && m >= 0 && m <= 59) minute = m;
        }

        switch (frequency) {
          case "hourly":
            cron = "0 * * * *";
            break;
          case "weekdays":
            cron = `${minute} ${hour} * * 1-5`;
            break;
          case "weekly": {
            const dayMap: Record<string, number> = {
              sunday: 0,
              monday: 1,
              tuesday: 2,
              wednesday: 3,
              thursday: 4,
              friday: 5,
              saturday: 6,
            };
            const d = dayOfWeek ? dayMap[dayOfWeek] ?? 1 : 1;
            cron = `${minute} ${hour} * * ${d}`;
            break;
          }
          case "monthly":
            cron = `${minute} ${hour} 1 * *`;
            break;
          case "daily":
          default:
            cron = `${minute} ${hour} * * *`;
            break;
        }
      }

      const normalizedTz = normalizeTriggerTimezone(timezone);

      const [schedule] = await db
        .insert(schedules)
        .values({
          userId,
          agentId,
          conversationId: conversationId ?? null,
          name,
          prompt,
          cronExpression: cron,
          timezone: normalizedTz,
          status: "active",
        })
        .returning();

      if (!schedule) {
        return { error: "Failed to create recurring schedule record in database." };
      }

      try {
        const triggerSched = await triggerSchedules.create({
          task: "run-scheduled-agent",
          cron,
          timezone: normalizedTz,
          externalId: schedule.id,
          deduplicationKey: `agent-recurring-${schedule.id}`,
        });

        if (triggerSched?.id) {
          await db
            .update(schedules)
            .set({ triggerScheduleId: triggerSched.id })
            .where(eq(schedules.id, schedule.id));
          schedule.triggerScheduleId = triggerSched.id;
        }
      } catch (triggerErr) {
        console.warn(
          "Could not register recurring schedule with Trigger.dev:",
          triggerErr,
        );
      }

      agentEventHub.publish(agentId, {
        type: "schedule_updated",
        scheduleId: schedule.id,
        action: "created",
      });

      return {
        scheduleId: schedule.id,
        name: schedule.name,
        prompt: schedule.prompt,
        cronExpression: schedule.cronExpression,
        timezone: schedule.timezone,
        status: schedule.status,
        message: `Recurring task '${name}' successfully scheduled with cron '${cron}' in timezone ${schedule.timezone}. The agent will automatically execute this instruction on schedule.`,
      };
    },
  });
}
