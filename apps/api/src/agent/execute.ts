import { runEventHub } from "@openbots/api-contract";
import { connections, db, messages, runSteps, runs } from "@openbots/db";
import { ToolLoopAgent } from "ai";
import { and, asc, eq, ne } from "drizzle-orm";
import { buildAgentTools } from "./tools.js";
import {
  abortActiveRun,
  registerRunAbortController,
  removeRunAbortController,
  sanitizeErrorMessage,
} from "./execution/abort-and-sanitize.js";
import {
  broadcastRunStart,
  handleInitialClaim,
  validateAgentAndRun,
} from "./execution/claim-and-validate.js";
import { prepareInputMessages } from "./execution/message-preparer.js";
import { buildSystemInstructions } from "./execution/prompt-builder.js";
import { resolveModel } from "./execution/resolve-model.js";
import {
  completeRunExecution,
  handleRunError,
  synthesizeFinalTextIfMissing,
} from "./execution/run-finalizer.js";
import { runAgentStreamLoop } from "./execution/stream-loop.js";

export { abortActiveRun, sanitizeErrorMessage };

export async function executeAgentRun(
  runId: string,
  options?: { signal?: AbortSignal },
) {
  const claimResult = await handleInitialClaim(runId, options, db);
  if (claimResult.earlyExit) return claimResult.run;
  const runRecord = claimResult.run;

  const agentRecord = await validateAgentAndRun(runId, runRecord, db);
  broadcastRunStart(runRecord, agentRecord);

  const abortController = new AbortController();
  registerRunAbortController(runId, abortController);

  const timeoutId = setTimeout(
    () => {
      abortController.abort(
        new Error("Run execution timed out (maximum 10 minutes exceeded)"),
      );
    },
    10 * 60 * 1000,
  );

  if (options?.signal) {
    if (options.signal.aborted) {
      abortController.abort(options.signal.reason);
    } else {
      options.signal.addEventListener(
        "abort",
        () => abortController.abort(options.signal?.reason),
        { once: true },
      );
    }
  }

  let resolvedTools: Awaited<ReturnType<typeof buildAgentTools>> | null = null;

  try {
    if (abortController.signal.aborted) {
      const [cancelledRun] = await db
        .update(runs)
        .set({ status: "cancelled", completedAt: new Date() })
        .where(and(eq(runs.id, runId), eq(runs.status, "running")))
        .returning();
      const [current] = await db.select().from(runs).where(eq(runs.id, runId));
      return cancelledRun ?? current ?? runRecord;
    }

    await db.delete(runSteps).where(eq(runSteps.runId, runId));

    const [resolvedToolsResult, historyMessages, activeConnections, model] =
      await Promise.all([
        buildAgentTools({
          userId: runRecord.userId,
          agentId: agentRecord.id,
          conversationId: runRecord.conversationId,
          agentRecord: {
            sandboxId: agentRecord.sandboxId,
            name: agentRecord.name,
          },
        }),
        runRecord.conversationId
          ? db
              .select()
              .from(messages)
              .where(eq(messages.conversationId, runRecord.conversationId))
              .orderBy(asc(messages.createdAt))
          : Promise.resolve([]),
        db
          .select({ provider: connections.provider })
          .from(connections)
          .where(
            and(
              eq(connections.userId, runRecord.userId),
              eq(connections.status, "active"),
              ne(connections.provider, "composio"),
            ),
          ),
        resolveModel(runRecord.userId, agentRecord.model),
      ]);

    resolvedTools = resolvedToolsResult;

    const inputMessages = await prepareInputMessages({
      historyMessages,
      runRecord,
    });

    const connectedApps = activeConnections.map((c: any) => c.provider);
    const inputObj = runRecord.input as any;
    const clientContext =
      inputObj?.clientContext ||
      (typeof runRecord.input === "object" && runRecord.input !== null
        ? (runRecord.input as any).clientContext
        : undefined);

    const systemInstructions = buildSystemInstructions({
      agentName: agentRecord.name,
      agentInstructions: agentRecord.instructions,
      triggerType: runRecord.triggerType,
      clientContext,
      connectedApps,
    });

    const agent = new ToolLoopAgent({
      model,
      instructions: systemInstructions,
      tools: resolvedTools.tools,
    });

    const currentStepNumber = { value: 0 };
    const pendingStepPersistTasks: Array<Promise<any>> = [];

    runEventHub.publish(runRecord.id, {
      type: "status",
      status: "running",
    });

    const streamLoopResult = await runAgentStreamLoop({
      agent,
      inputMessages,
      ctx: {
        runId: runRecord.id,
        agentModel: agentRecord.model,
        abortController,
        currentStepNumber,
        pendingStepPersistTasks,
      },
    });

    let finalText = streamLoopResult.finalText;
    if (!finalText) {
      finalText = await synthesizeFinalTextIfMissing(runRecord.id);
    }

    return await completeRunExecution({
      runId,
      runRecord,
      agentRecord,
      finalText,
      totalStepsCount: streamLoopResult.totalStepsCount,
      aggregatedUsage: streamLoopResult.aggregatedUsage,
      pendingStepPersistTasks,
    });
  } catch (error) {
    const safeError = sanitizeErrorMessage(error);
    return await handleRunError({
      runId,
      runRecord,
      agentRecord,
      error,
      aborted: abortController.signal.aborted,
      safeError,
    });
  } finally {
    clearTimeout(timeoutId);
    removeRunAbortController(runId);
    if (resolvedTools) {
      await resolvedTools.cleanup();
    }
  }
}
