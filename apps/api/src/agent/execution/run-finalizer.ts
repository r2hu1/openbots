import { agentEventHub, runEventHub, sendUserPushNotification } from "@openbots/api-contract";
import { db, messages, runSteps, runs } from "@openbots/db";
import { asc, eq } from "drizzle-orm";

export async function synthesizeFinalTextIfMissing(runId: string): Promise<string> {
  const allRunSteps = await db
    .select()
    .from(runSteps)
    .where(eq(runSteps.runId, runId))
    .orderBy(asc(runSteps.stepNumber));

  const fileStep = allRunSteps.find(
    (s) =>
      s.toolName === "create_downloadable_file" ||
      s.toolName === "save_and_share_file",
  );

  if (fileStep?.toolOutput) {
    const out = fileStep.toolOutput as Record<string, any>;
    if (out.inlineArtifactSnippet) {
      return `I have generated your file.\n\n${out.inlineArtifactSnippet}`;
    }
    if (out.downloadUrl) {
      return `I have generated and saved your file: [${out.fileName || "Download file"}](${out.downloadUrl})`;
    }
  }

  return "I have completed the requested actions. Please let me know if you would like me to adjust or expand anything!";
}

export async function completeRunExecution(params: {
  runId: string;
  runRecord: any;
  agentRecord: any;
  finalText: string;
  totalStepsCount: number;
  aggregatedUsage: any;
  pendingStepPersistTasks: Array<Promise<any>>;
}) {
  const {
    runId,
    runRecord,
    agentRecord,
    finalText,
    totalStepsCount,
    aggregatedUsage,
    pendingStepPersistTasks,
  } = params;

  if (pendingStepPersistTasks.length > 0) {
    await Promise.allSettled(pendingStepPersistTasks);
  }

  const finalOutput = {
    text: finalText,
    steps: totalStepsCount,
    usage: aggregatedUsage,
  };

  const [completedRunRows] = await Promise.all([
    db
      .update(runs)
      .set({
        status: "completed",
        output: finalOutput,
        completedAt: new Date(),
      })
      .where(eq(runs.id, runId))
      .returning(),
    runRecord.conversationId && finalText
      ? db
          .insert(messages)
          .values({
            conversationId: runRecord.conversationId,
            role: "assistant",
            content: { text: finalText },
          })
          .returning()
      : Promise.resolve([]),
  ]);

  const completedRun = completedRunRows[0];

  runEventHub.publish(runRecord.id, {
    type: "done",
    status: "completed",
    output: finalOutput,
  });

  agentEventHub.publish(
    agentRecord.id,
    {
      type: "run_status",
      runId: runRecord.id,
      status: "completed",
      output: finalOutput,
      conversationId: runRecord.conversationId,
    },
    runRecord.userId,
  );

  if (!completedRun) {
    const [finalRun] = await db.select().from(runs).where(eq(runs.id, runId));
    return finalRun ?? { id: runId, status: "cancelled", output: finalOutput };
  }

  const scheduleInputObj = runRecord.input as any;
  const isSchedule =
    runRecord.triggerType === "schedule" ||
    Boolean(scheduleInputObj?.recurringScheduleId) ||
    Boolean(scheduleInputObj?.scheduledTaskName);

  if (isSchedule && runRecord.userId) {
    const scheduledTaskName =
      scheduleInputObj?.scheduledTaskName ||
      agentRecord.name ||
      "Scheduled Task";
    const notificationBody =
      finalText.slice(0, 180) ||
      (typeof scheduleInputObj === "string"
        ? scheduleInputObj
        : scheduleInputObj?.prompt) ||
      "Your scheduled task has completed.";

    try {
      await sendUserPushNotification(runRecord.userId, {
        title: scheduledTaskName,
        body: notificationBody,
        url: runRecord.conversationId
          ? `/agent/${agentRecord.id}`
          : `/agent/${agentRecord.id}?runId=${runRecord.id}`,
        tag: `schedule-${runRecord.id}`,
      });
    } catch (err) {
      console.warn("Failed to dispatch scheduled push notification:", err);
    }
  }

  return completedRun;
}

export async function handleRunError(params: {
  runId: string;
  runRecord: any;
  agentRecord: any;
  error: unknown;
  aborted: boolean;
  safeError: string;
}) {
  const { runId, runRecord, agentRecord, aborted, safeError } = params;
  const [currentRun] = await db.select().from(runs).where(eq(runs.id, runId));

  if (currentRun?.status === "cancelled" || aborted) {
    const stopMessageText = "Execution stopped by user.";
    if (currentRun?.status !== "cancelled" || !currentRun?.output) {
      await db
        .update(runs)
        .set({
          status: "cancelled",
          output: currentRun?.output || { text: stopMessageText },
          completedAt: new Date(),
        })
        .where(eq(runs.id, runId));

      if (runRecord.conversationId) {
        try {
          await db.insert(messages).values({
            conversationId: runRecord.conversationId,
            role: "assistant",
            content: { text: stopMessageText },
          });
        } catch {}
      }
    }
    runEventHub.publish(runId, {
      type: "status",
      status: "cancelled",
      output: currentRun?.output || { text: stopMessageText },
    });
    agentEventHub.publish(
      agentRecord?.id ?? runRecord.agentId,
      {
        type: "run_status",
        runId,
        status: "cancelled",
        output: currentRun?.output || { text: stopMessageText },
        conversationId: runRecord.conversationId,
      },
      runRecord.userId,
    );
    const [finalRun] = await db.select().from(runs).where(eq(runs.id, runId));
    return finalRun ?? currentRun;
  }

  await db
    .update(runs)
    .set({
      status: "failed",
      error: safeError,
      completedAt: new Date(),
    })
    .where(eq(runs.id, runId));

  runEventHub.publish(runId, {
    type: "status",
    status: "failed",
    error: safeError,
  });
  agentEventHub.publish(
    agentRecord?.id ?? runRecord.agentId,
    {
      type: "run_status",
      runId,
      status: "failed",
      error: safeError,
      conversationId: runRecord.conversationId,
    },
    runRecord.userId,
  );

  const scheduleInputObj = runRecord.input as any;
  const isSchedule =
    runRecord.triggerType === "schedule" ||
    Boolean(scheduleInputObj?.recurringScheduleId) ||
    Boolean(scheduleInputObj?.scheduledTaskName);

  if (isSchedule && runRecord.userId) {
    const scheduledTaskName =
      scheduleInputObj?.scheduledTaskName ||
      agentRecord?.name ||
      "Scheduled Task";
    sendUserPushNotification(runRecord.userId, {
      title: `⚠️ ${scheduledTaskName} (Failed)`,
      body: safeError || "Scheduled task failed to complete.",
      url: runRecord.conversationId
        ? `/agent/${runRecord.agentId}`
        : `/agent/${runRecord.agentId}?runId=${runRecord.id}`,
      tag: `schedule-${runRecord.id}`,
    }).catch((err) => {
      console.warn("Failed to dispatch scheduled failure push notification:", err);
    });
  }

  throw new Error(safeError);
}
