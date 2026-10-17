import { tool } from "ai";
import { z } from "zod";
import { handleCancelAction } from "./schedule-actions.js";
import { handleModifyAction } from "./schedule-modify.js";
import { handleHistoryAction, handleListAction } from "./schedule-query.js";

export function manageScheduleTool(
  userId: string,
  agentId: string,
  _conversationId?: string | null,
) {
  return tool({
    description:
      "Manage, inspect, check history, reschedule, modify, or cancel internal OpenBots background agent tasks and recurring cron jobs. " +
      "Use this when the user specifically asks about their OpenBots automated agent tasks, agent background jobs, or cron reminders. " +
      "NOTE: If the user asks about their personal schedule, calendar, meetings, or agenda (e.g. 'what's my schedule today?', 'what's on my calendar?'), and a calendar integration (Google Calendar, Outlook) is connected via Composio, prioritize checking their external calendar instead of this tool. " +
      "Use this tool whenever the user asks to: " +
      "(1) List or check active/pending OpenBots background agent tasks or agent reminders (e.g. 'what background tasks are running?', 'show my agent scheduled jobs'), " +
      "(2) Check past agent execution history (e.g. 'did my task run?', 'how many tasks ran?', 'show execution history'), " +
      "(3) Cancel an agent background task or reminder (e.g. 'cancel my tea reminder', 'cancel task 123', 'delete agent reminder'), " +
      "(4) Modify or reschedule an agent background task or reminder (e.g. 'change my tea reminder to 10 minutes', 'reschedule agent task to 5pm').",
    inputSchema: z.object({
      action: z
        .enum(["list", "history", "cancel", "modify"])
        .describe(
          "Action to perform: 'list' to see all pending/active tasks, 'history' to see past executed tasks and results, 'cancel' to stop/delete a scheduled task, or 'modify' to change its timing or prompt",
        ),
      taskId: z
        .string()
        .optional()
        .describe(
          "The ID of the queued run or recurring schedule (obtained from 'list' action or prior creation)",
        ),
      taskName: z
        .string()
        .optional()
        .describe(
          "Fuzzy name or title of the task to find, cancel, or modify (e.g. 'tea reminder') if ID is unknown",
        ),
      newName: z
        .string()
        .optional()
        .describe("New title/name for the task when action is 'modify'"),
      newPrompt: z
        .string()
        .optional()
        .describe(
          "New prompt or instruction for the task when action is 'modify'",
        ),
      delaySeconds: z
        .number()
        .optional()
        .describe(
          "New seconds from now to execute when modifying a one-off delay task (e.g. 600 for 10 minutes)",
        ),
      runAt: z
        .string()
        .optional()
        .describe(
          "New ISO 8601 timestamp string for when to run when modifying a timestamped task",
        ),
      cronExpression: z
        .string()
        .optional()
        .describe(
          "New cron expression when modifying a recurring schedule (e.g. '0 10 * * *')",
        ),
      timezone: z
        .string()
        .optional()
        .describe("New IANA timezone (e.g. 'UTC', 'America/New_York')"),
    }),
    execute: async ({
      action,
      taskId,
      taskName,
      newName,
      newPrompt,
      delaySeconds,
      runAt,
      cronExpression,
      timezone,
    }) => {
      if (action === "list") {
        return await handleListAction(userId, agentId);
      }

      const normalize = (s?: string | null) => (s ?? "").trim().toLowerCase();
      const searchTarget = normalize(taskName);

      if (action === "history") {
        return await handleHistoryAction(userId, agentId, searchTarget);
      }

      if (action === "cancel") {
        return await handleCancelAction(userId, agentId, taskId, searchTarget);
      }

      if (action === "modify") {
        return await handleModifyAction({
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
        });
      }

      return {
        error: `Unknown action: ${action}`,
      };
    },
  });
}
