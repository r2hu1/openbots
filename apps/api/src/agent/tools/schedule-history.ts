import { db, runs } from "@openbots/db";
import { tool } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

export function getTaskHistoryTool(userId: string, agentId: string) {
  return tool({
    description:
      "Get the execution history of scheduled tasks and reminders. " +
      "Use this to find out: " +
      "(1) How many scheduled tasks have run, " +
      "(2) When each task ran (start time, completion time, duration), " +
      "(3) What tasks ran (name, prompt, trigger type), " +
      "(4) The status and results/output of past executions (completed, failed, errors). " +
      "ALWAYS use this whenever the user asks 'did my reminder run?', 'what tasks ran?', 'show task history', 'when did my task run?', or 'how many times did my schedule run?'.",
    inputSchema: z.object({
      taskId: z
        .string()
        .optional()
        .describe(
          "Optional specific schedule ID or run ID to filter history for",
        ),
      taskName: z
        .string()
        .optional()
        .describe(
          "Optional fuzzy task name to search in execution history (e.g. 'crypto', 'tea reminder')",
        ),
      status: z
        .enum(["all", "completed", "failed", "cancelled", "running"])
        .default("all")
        .describe(
          "Filter by execution status: 'all', 'completed', 'failed', 'cancelled', 'running'",
        ),
      limit: z
        .number()
        .default(20)
        .describe(
          "Maximum number of past execution records to return (1-50, default 20)",
        ),
    }),
    execute: async ({ taskId, taskName, status, limit }) => {
      const conditions = [
        eq(runs.userId, userId),
        eq(runs.agentId, agentId),
        eq(runs.triggerType, "schedule"),
      ];

      if (status && status !== "all") {
        conditions.push(eq(runs.status, status as any));
      }

      if (taskId) {
        conditions.push(eq(runs.id, taskId));
      }

      const pastRuns = await db
        .select({
          id: runs.id,
          status: runs.status,
          triggerType: runs.triggerType,
          input: runs.input,
          output: runs.output,
          error: runs.error,
          startedAt: runs.startedAt,
          completedAt: runs.completedAt,
          createdAt: runs.createdAt,
        })
        .from(runs)
        .where(and(...conditions))
        .orderBy(desc(runs.createdAt))
        .limit(Math.min(50, Math.max(1, limit ?? 20)));

      const normalize = (s?: string | null) => (s ?? "").trim().toLowerCase();
      const filterName = normalize(taskName);

      const filteredRuns = filterName
        ? pastRuns.filter((r) => {
            const inp = (r.input as any) ?? {};
            const name = normalize(inp.scheduledTaskName);
            const prompt = normalize(inp.prompt);
            return name.includes(filterName) || prompt.includes(filterName);
          })
        : pastRuns;

      const formatted = filteredRuns.map((r) => {
        const inp = (r.input as any) ?? {};
        const out = (r.output as any) ?? {};
        const outText =
          typeof out?.text === "string"
            ? out.text
            : typeof out === "string"
              ? out
              : "";
        const durationSeconds =
          r.startedAt && r.completedAt
            ? Math.max(
                0,
                Math.round(
                  (new Date(r.completedAt).getTime() -
                    new Date(r.startedAt).getTime()) /
                    1000,
                ),
              )
            : null;

        return {
          runId: r.id,
          taskName: inp.scheduledTaskName ?? "Scheduled Task",
          prompt: inp.prompt ?? (typeof inp === "string" ? inp : ""),
          status: r.status,
          startedAt: r.startedAt?.toISOString() ?? null,
          completedAt: r.completedAt?.toISOString() ?? null,
          durationSeconds,
          outputPreview:
            outText.length > 300 ? `${outText.slice(0, 300)}...` : outText,
          fullOutput: outText,
          error: r.error ?? null,
        };
      });

      const totalRuns = formatted.length;
      const completedCount = formatted.filter(
        (f) => f.status === "completed",
      ).length;
      const failedCount = formatted.filter((f) => f.status === "failed").length;

      let summaryMessage = "";
      const lastRun = formatted[0];
      if (!lastRun) {
        summaryMessage = "No scheduled task execution records found.";
      } else {
        summaryMessage =
          `Found ${totalRuns} scheduled execution(s): ${completedCount} completed successfully, ${failedCount} failed. ` +
          `The most recent task was '${lastRun.taskName}' which ${lastRun.status} at ${lastRun.completedAt ?? lastRun.startedAt ?? "unknown time"}.`;
      }

      return {
        totalExecutedCount: totalRuns,
        completedCount,
        failedCount,
        executions: formatted,
        summary: summaryMessage,
      };
    },
  });
}
