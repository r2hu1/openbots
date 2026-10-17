import { db, runs, schedules } from "@openbots/db";
import { and, desc, eq, inArray } from "drizzle-orm";

export async function handleListAction(userId: string, agentId: string) {
  const queuedRuns = await db
    .select({
      id: runs.id,
      agentId: runs.agentId,
      status: runs.status,
      triggerType: runs.triggerType,
      input: runs.input,
      createdAt: runs.createdAt,
    })
    .from(runs)
    .where(
      and(
        eq(runs.userId, userId),
        eq(runs.agentId, agentId),
        eq(runs.status, "queued"),
        eq(runs.triggerType, "schedule"),
      ),
    )
    .orderBy(desc(runs.createdAt));

  const activeSchedules = await db
    .select()
    .from(schedules)
    .where(
      and(
        eq(schedules.userId, userId),
        eq(schedules.agentId, agentId),
        eq(schedules.status, "active"),
      ),
    )
    .orderBy(desc(schedules.createdAt));

  const recentPastRuns = await db
    .select({
      id: runs.id,
      status: runs.status,
      input: runs.input,
      output: runs.output,
      startedAt: runs.startedAt,
      completedAt: runs.completedAt,
    })
    .from(runs)
    .where(
      and(
        eq(runs.userId, userId),
        eq(runs.agentId, agentId),
        eq(runs.triggerType, "schedule"),
        inArray(runs.status, ["completed", "failed"]),
      ),
    )
    .orderBy(desc(runs.createdAt))
    .limit(3);

  const formattedQueued = queuedRuns.map((r) => {
    const inp = (r.input as any) ?? {};
    return {
      id: r.id,
      type: "delayed_reminder" as const,
      name: inp.scheduledTaskName ?? "Unnamed Reminder",
      prompt: inp.prompt ?? (typeof inp === "string" ? inp : ""),
      scheduledFor: inp.scheduledFor ?? null,
      status: r.status,
      createdAt: r.createdAt,
    };
  });

  const formattedRecurring = activeSchedules.map((s) => ({
    id: s.id,
    type: "recurring_schedule" as const,
    name: s.name,
    prompt: s.prompt,
    cronExpression: s.cronExpression,
    timezone: s.timezone,
    status: s.status,
    createdAt: s.createdAt,
  }));

  const totalActive = formattedQueued.length + formattedRecurring.length;
  const totalPastExecuted = recentPastRuns.length;

  return {
    totalActive,
    queuedReminders: formattedQueued,
    recurringSchedules: formattedRecurring,
    recentExecutionSummary: {
      recentlyCompletedCount: totalPastExecuted,
      latestExecution: recentPastRuns[0]
        ? {
            id: recentPastRuns[0].id,
            taskName:
              (recentPastRuns[0].input as any)?.scheduledTaskName ??
              "Scheduled Task",
            status: recentPastRuns[0].status,
            completedAt: recentPastRuns[0].completedAt?.toISOString(),
          }
        : null,
    },
    message:
      totalActive === 0
        ? totalPastExecuted > 0
          ? `You have no active pending tasks, but ${totalPastExecuted} past task(s) ran recently (call action='history' to inspect them).`
          : "You have no active scheduled tasks or queued reminders."
        : `Found ${totalActive} active scheduled item(s): ${formattedQueued.length} queued reminder(s) and ${formattedRecurring.length} recurring schedule(s).`,
  };
}

export async function handleHistoryAction(
  userId: string,
  agentId: string,
  searchTarget: string,
) {
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
    .where(
      and(
        eq(runs.userId, userId),
        eq(runs.agentId, agentId),
        eq(runs.triggerType, "schedule"),
      ),
    )
    .orderBy(desc(runs.createdAt))
    .limit(20);

  const normalize = (s?: string | null) => (s ?? "").trim().toLowerCase();
  const filtered = searchTarget
    ? pastRuns.filter((r) => {
        const inp = (r.input as any) ?? {};
        const name = normalize(inp.scheduledTaskName);
        const prompt = normalize(inp.prompt);
        return name.includes(searchTarget) || prompt.includes(searchTarget);
      })
    : pastRuns;

  const formattedHistory = filtered.map((r) => {
    const inp = (r.input as any) ?? {};
    const out = (r.output as any) ?? {};
    const outText =
      typeof out?.text === "string" ? out.text : typeof out === "string" ? out : "";
    const duration =
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
      name: inp.scheduledTaskName ?? "Scheduled Task",
      prompt: inp.prompt ?? (typeof inp === "string" ? inp : ""),
      status: r.status,
      startedAt: r.startedAt?.toISOString() ?? null,
      completedAt: r.completedAt?.toISOString() ?? null,
      durationSeconds: duration,
      output: outText.length > 400 ? `${outText.slice(0, 400)}...` : outText,
      error: r.error ?? null,
    };
  });

  const completedCount = formattedHistory.filter(
    (f) => f.status === "completed",
  ).length;
  const failedCount = formattedHistory.filter((f) => f.status === "failed").length;

  return {
    totalRanCount: formattedHistory.length,
    completedCount,
    failedCount,
    history: formattedHistory,
    message:
      formattedHistory.length === 0
        ? "No scheduled tasks or reminders have run yet."
        : `Found ${formattedHistory.length} executed scheduled task(s): ${completedCount} completed successfully, ${failedCount} failed.`,
  };
}
