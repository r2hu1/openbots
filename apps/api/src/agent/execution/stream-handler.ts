import { runEventHub } from "@openbots/api-contract";
import { db, getRedis, runSteps } from "@openbots/db";

export interface StreamContext {
  runId: string;
  agentModel: string;
  abortController: AbortController;
  currentStepNumber: { value: number };
  pendingStepPersistTasks: Array<Promise<any>>;
}

export function createStepFinishHandler(ctx: StreamContext) {
  return async (step: any) => {
    if (ctx.abortController.signal.aborted) return;

    if (
      ctx.currentStepNumber.value > 0 &&
      ctx.currentStepNumber.value % 3 === 0
    ) {
      try {
        const redis = getRedis();
        if (redis) {
          const isCancelled = await redis.get<string>(
            `run_cancelled:${ctx.runId}`,
          );
          if (isCancelled) {
            ctx.abortController.abort(new Error("Run cancelled remotely"));
            return;
          }
        }
      } catch {}
    }

    const stepsToInsert: Array<typeof runSteps.$inferInsert> = [];

    stepsToInsert.push({
      runId: ctx.runId,
      stepNumber: ctx.currentStepNumber.value++,
      type: "model",
      status: "completed",
      model: ctx.agentModel,
      output: {
        text: step.text,
        finishReason: step.finishReason,
        usage: step.usage,
      },
    });

    if (step.toolResults && step.toolResults.length > 0) {
      for (const tr of step.toolResults) {
        stepsToInsert.push({
          runId: ctx.runId,
          stepNumber: ctx.currentStepNumber.value++,
          type: "tool",
          status: "completed",
          toolName: tr.toolName,
          toolCallId: tr.toolCallId,
          toolInput: ((tr as any).input ?? (tr as any).args ?? null) as any,
          toolOutput: ((tr as any).output ?? (tr as any).result ?? null) as any,
        });

        runEventHub.publish(ctx.runId, {
          type: "tool_finish",
          toolName: tr.toolName,
          toolCallId: tr.toolCallId,
          stepNumber: ctx.currentStepNumber.value - 1,
          output: ((tr as any).output ?? (tr as any).result ?? null) as any,
        });
      }
    }

    const insertPromise = db
      .insert(runSteps)
      .values(stepsToInsert)
      .catch((err) => {
        console.warn("Failed to persist step batch:", err);
      });

    ctx.pendingStepPersistTasks.push(insertPromise);
  };
}

export async function consumeStream(streamResult: any, ctx: StreamContext) {
  let accumulatedStreamText = "";
  let streamError: any = null;
  let pendingDeltaBuffer = "";
  let lastFlushTime = Date.now();

  const flushDeltas = () => {
    if (pendingDeltaBuffer) {
      runEventHub.publish(ctx.runId, {
        type: "delta",
        text: pendingDeltaBuffer,
      });
      pendingDeltaBuffer = "";
      lastFlushTime = Date.now();
    }
  };

  for await (const part of streamResult.fullStream) {
    if (ctx.abortController.signal.aborted) break;

    if (part.type === "text-delta") {
      accumulatedStreamText += part.text;
      pendingDeltaBuffer += part.text;
      if (
        Date.now() - lastFlushTime >= 40 ||
        pendingDeltaBuffer.length >= 30
      ) {
        flushDeltas();
      }
    } else if (part.type === "tool-call") {
      flushDeltas();
      runEventHub.publish(ctx.runId, {
        type: "tool_start",
        toolName: part.toolName,
        toolCallId: (part as any).toolCallId,
        stepNumber: ctx.currentStepNumber.value,
      });
    } else if (part.type === "tool-result") {
      flushDeltas();
      runEventHub.publish(ctx.runId, {
        type: "tool_finish",
        toolName: (part as any).toolName,
        toolCallId: (part as any).toolCallId,
        output: (part as any).result ?? (part as any).output ?? null,
      });
    } else if (part.type === "error") {
      flushDeltas();
      streamError = (part as any).error;
    }
  }
  flushDeltas();

  return { accumulatedStreamText, streamError };
}
