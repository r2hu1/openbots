import { agentEventHub } from "@openbots/api-contract";
import { agents, runs } from "@openbots/db";
import { and, eq, inArray } from "drizzle-orm";

export async function handleInitialClaim(
  runId: string,
  options?: { signal?: AbortSignal },
  dbInstance?: any,
) {
  const db = dbInstance;
  if (options?.signal?.aborted) {
    const [cancelledRun] = await db
      .update(runs)
      .set({
        status: "cancelled",
        completedAt: new Date(),
      })
      .where(
        and(eq(runs.id, runId), inArray(runs.status, ["queued", "running"])),
      )
      .returning();

    if (cancelledRun) return { earlyExit: true, run: cancelledRun };
    const [existing] = await db.select().from(runs).where(eq(runs.id, runId));
    return {
      earlyExit: true,
      run: existing ?? { id: runId, status: "cancelled" },
    };
  }

  const [claimedRun] = await db
    .update(runs)
    .set({
      status: "running",
      startedAt: new Date(),
    })
    .where(and(eq(runs.id, runId), eq(runs.status, "queued")))
    .returning();

  if (!claimedRun) {
    const [existingRun] = await db
      .select()
      .from(runs)
      .where(eq(runs.id, runId));

    if (!existingRun) {
      throw new Error(`Run not found: ${runId}`);
    }
    return { earlyExit: true, run: existingRun };
  }

  return { earlyExit: false, run: claimedRun };
}

export async function validateAgentAndRun(
  runId: string,
  runRecord: any,
  dbInstance: any,
) {
  const db = dbInstance;
  const [agentRecord] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, runRecord.agentId));

  if (!agentRecord) {
    const errorMsg = `Agent not found for run ${runId}`;
    await db
      .update(runs)
      .set({
        status: "failed",
        error: errorMsg,
        completedAt: new Date(),
      })
      .where(and(eq(runs.id, runId), eq(runs.status, "running")));
    throw new Error(errorMsg);
  }

  if (agentRecord.userId !== runRecord.userId) {
    const errorMsg = "Run owner does not match agent owner";
    await db
      .update(runs)
      .set({
        status: "failed",
        error: errorMsg,
        completedAt: new Date(),
      })
      .where(and(eq(runs.id, runId), eq(runs.status, "running")));
    throw new Error(errorMsg);
  }

  if (agentRecord.autonomy !== "manual") {
    const errorMsg = `Unsupported autonomy mode '${agentRecord.autonomy}'. Currently only 'manual' is supported.`;
    await db
      .update(runs)
      .set({
        status: "failed",
        error: errorMsg,
        completedAt: new Date(),
      })
      .where(and(eq(runs.id, runId), eq(runs.status, "running")));
    throw new Error(errorMsg);
  }

  return agentRecord;
}

export function broadcastRunStart(runRecord: any, agentRecord: any) {
  agentEventHub.publish(
    agentRecord.id,
    {
      type: "run_status",
      runId: runRecord.id,
      status: "running",
      conversationId: runRecord.conversationId,
    },
    runRecord.userId,
  );

  if (runRecord.triggerType === "schedule") {
    const inputObj = runRecord.input as any;
    agentEventHub.publish(
      agentRecord.id,
      {
        type: "schedule_fired",
        scheduleId: inputObj?.recurringScheduleId,
        runId: runRecord.id,
        name: inputObj?.scheduledTaskName,
        prompt:
          inputObj?.prompt ??
          (typeof inputObj === "string" ? inputObj : undefined),
        conversationId: runRecord.conversationId,
      },
      runRecord.userId,
    );
  }
}
