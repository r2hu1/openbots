import {
  agentEventHub,
  getDirectRunExecutor,
  normalizeTriggerTimezone,
} from "@openbots/api-contract";
import { db, runs, schedules } from "@openbots/db";
import {
  tasks,
  schedules as triggerSchedules,
} from "@trigger.dev/sdk";
import { tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";

export function createScheduleTool(
  userId: string,
  agentId: string,
  conversationId?: string | null,
) {
  return tool({
    description:
      "Schedule any kind of future task, reminder, delayed execution, or recurring job. " +
      "Use this for: " +
      "(1) Delayed execution or reminders (e.g. 'in 1 minute', 'in 30 seconds', 'after 2 hours', 'remind me to have tea'), " +
      "(2) Specific future timestamps/dates (e.g. 'at 5:00 PM', 'tomorrow at 9am', 'on Oct 10th'), " +
      "(3) Recurring schedules (e.g. 'every day at 9am', 'every 15 minutes', 'every Monday'). " +
      "ALWAYS use this tool for all scheduling, delayed triggers, reminders, and timers.",
    inputSchema: z.object({
      name: z
        .string()
        .describe(
          "A short descriptive title for the scheduled task or reminder",
        ),
      prompt: z
        .string()
        .describe(
          "The instruction, reminder message, or task to execute when the schedule triggers",
        ),
      type: z
        .enum(["delay", "recurring", "timestamp"])
        .default("delay")
        .describe(
          "Schedule type: 'delay' for one-off tasks relative to now (e.g. in 1 min), 'timestamp' for specific date/time, 'recurring' for cron schedules",
        ),
      delaySeconds: z
        .number()
        .optional()
        .describe(
          "Seconds to wait before executing (required for 'delay' type, e.g. 60 for 1 minute, 120 for 2 minutes, 3600 for 1 hour)",
        ),
      runAt: z
        .string()
        .optional()
        .describe(
          "ISO 8601 timestamp string for when to run (e.g. '2026-10-02T15:00:00Z')",
        ),
      cronExpression: z
        .string()
        .optional()
        .describe(
          "A standard 5-field cron expression for recurring tasks (e.g. '0 9 * * *' for daily at 9am, '*/15 * * * *' for every 15 minutes)",
        ),
      timezone: z
        .string()
        .optional()
        .describe(
          "IANA timezone (e.g. 'America/New_York', 'Asia/Kolkata', 'UTC'). Defaults to UTC.",
        ),
    }),
    execute: async ({
      name,
      prompt,
      type,
      delaySeconds,
      runAt,
      cronExpression,
      timezone,
    }) => {
      if (type === "recurring" || (cronExpression && !delaySeconds && !runAt)) {
        const cron = cronExpression ?? "0 9 * * *";
        const normalizedTz = normalizeTriggerTimezone(timezone);

        const inserted = await db
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
        const schedule = inserted[0];

        if (!schedule) {
          throw new Error("Failed to create recurring schedule");
        }

        try {
          const triggerSched = await triggerSchedules.create({
            task: "scheduled-agent-task",
            cron,
            timezone: normalizedTz,
            deduplicationKey: schedule.id,
            externalId: schedule.id,
            window: "0m",
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

        return {
          scheduleId: schedule.id,
          name: schedule.name,
          type: "recurring",
          cronExpression: schedule.cronExpression,
          timezone: schedule.timezone,
          status: schedule.status,
          message: `Recurring schedule '${name}' set. It will execute with cron '${cron}' in timezone ${schedule.timezone}.`,
        };
      }

      let computedDelaySeconds = delaySeconds;

      if (type === "timestamp" || runAt) {
        if (!runAt) {
          throw new Error(
            "Missing 'runAt' ISO timestamp for timestamp schedule",
          );
        }
        const targetTime = new Date(runAt).getTime();
        const now = Date.now();
        const diffMs = targetTime - now;
        computedDelaySeconds = Math.max(1, Math.round(diffMs / 1000));
      }

      if (!computedDelaySeconds || computedDelaySeconds <= 0) {
        computedDelaySeconds = 60;
      }

      const [newRun] = await db
        .insert(runs)
        .values({
          userId,
          agentId,
          conversationId: conversationId ?? null,
          status: "queued",
          triggerType: "schedule",
          input: {
            prompt,
            scheduledTaskName: name,
            scheduledFor: new Date(
              Date.now() + computedDelaySeconds * 1000,
            ).toISOString(),
          },
        })
        .returning();

      if (!newRun) {
        throw new Error("Failed to queue scheduled run");
      }

      agentEventHub.publish(agentId, {
        type: "schedule_updated",
        scheduleId: newRun.id,
        action: "created",
      });

      try {
        await tasks.trigger(
          "agent-run",
          { runId: newRun.id },
          {
            delay: `${computedDelaySeconds}s`,
            idempotencyKey: newRun.id,
            tags: [newRun.id, userId],
          },
        );
      } catch (triggerErr) {
        console.warn(
          "Could not dispatch delayed Trigger.dev task:",
          triggerErr,
        );
      }

      if (computedDelaySeconds <= 3600) {
        setTimeout(async () => {
          try {
            const directExecutor = getDirectRunExecutor();
            if (directExecutor) {
              await directExecutor(newRun.id);
            }
          } catch {}
        }, computedDelaySeconds * 1000);
      }

      const durationStr =
        computedDelaySeconds < 60
          ? `${computedDelaySeconds} second${computedDelaySeconds === 1 ? "" : "s"}`
          : computedDelaySeconds < 3600
            ? `${Math.round(computedDelaySeconds / 60)} minute${Math.round(computedDelaySeconds / 60) === 1 ? "" : "s"}`
            : `${(computedDelaySeconds / 3600).toFixed(1)} hours`;

      return {
        runId: newRun.id,
        name,
        type: "delay",
        delaySeconds: computedDelaySeconds,
        executesAt: new Date(
          Date.now() + computedDelaySeconds * 1000,
        ).toISOString(),
        message: `Scheduled reminder '${name}' successfully set for ${durationStr} from now. I will trigger and perform this task automatically.`,
      };
    },
  });
}
