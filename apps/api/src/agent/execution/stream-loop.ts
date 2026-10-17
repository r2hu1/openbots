import {
  consumeStream,
  createStepFinishHandler,
  type StreamContext,
} from "./stream-handler.js";

export function detectRepetitiveLoop(passSteps: any[]): boolean {
  const recentToolSignatures = passSteps
    .flatMap((s) => s.toolCalls || [])
    .map(
      (tc: any) =>
        `${tc.toolName}:${JSON.stringify(tc.input ?? tc.args ?? null)}`,
    );

  return (
    recentToolSignatures.length >= 3 &&
    recentToolSignatures.every((sig) => sig === recentToolSignatures[0])
  );
}

export function sanitizeToolResponseMessages(responseMessages: any[]): any[] {
  return (responseMessages || []).map((msg: any) => {
    if (msg.role === "tool" && Array.isArray(msg.content)) {
      return {
        ...msg,
        content: msg.content.map((part: any) => {
          if (
            part.type === "tool-result" &&
            typeof part.result === "string" &&
            part.result.length > 30000
          ) {
            return {
              ...part,
              result: `${part.result.slice(0, 30000)}\n\n[...output truncated for context limit...]`,
            };
          }
          return part;
        }),
      };
    }
    return msg;
  });
}

export async function runAgentStreamLoop(params: {
  agent: any;
  inputMessages: any[];
  ctx: StreamContext;
}) {
  const { agent, inputMessages, ctx } = params;
  const MAX_CONTINUATION_PASSES = 100;
  let finalText = "";
  let totalStepsCount = 0;
  const aggregatedUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };

  let activeInputMessages = [...inputMessages];

  for (let pass = 0; pass < MAX_CONTINUATION_PASSES; pass++) {
    if (ctx.abortController.signal.aborted) break;

    const streamResult = await agent.stream({
      messages: activeInputMessages as any,
      abortSignal: ctx.abortController.signal,
      onStepFinish: createStepFinishHandler(ctx),
    });

    const { accumulatedStreamText, streamError } = await consumeStream(
      streamResult,
      ctx,
    );

    let passText = "";
    try {
      passText = (await streamResult.text)?.trim() || "";
    } catch (textErr) {
      if (accumulatedStreamText.trim()) {
        passText = accumulatedStreamText.trim();
      } else if (streamError) {
        throw streamError;
      } else {
        throw textErr;
      }
    }

    const passSteps = (await streamResult.steps) ?? [];
    totalStepsCount += passSteps.length;

    try {
      const passUsage = await streamResult.usage;
      if (passUsage) {
        aggregatedUsage.inputTokens += passUsage.inputTokens ?? 0;
        aggregatedUsage.outputTokens += passUsage.outputTokens ?? 0;
        aggregatedUsage.totalTokens += passUsage.totalTokens ?? 0;
      }
    } catch {}

    if (ctx.pendingStepPersistTasks.length > 0) {
      await Promise.allSettled(ctx.pendingStepPersistTasks);
    }

    if (passText) {
      finalText = passText;
      break;
    }

    const newResponseMessages = await streamResult.responseMessages;
    const hasToolActivity =
      passSteps.some((s: any) => s.toolCalls?.length || s.toolResults?.length) ||
      (newResponseMessages && newResponseMessages.length > 0);

    if (detectRepetitiveLoop(passSteps)) {
      console.warn(
        `[Agent Execution] Detected repetitive tool loop for run ${ctx.runId}. Halting continuation.`,
      );
      finalText =
        "I encountered repetitive tool execution patterns and concluded the task with the available information.";
      break;
    }

    if (
      hasToolActivity &&
      pass < MAX_CONTINUATION_PASSES - 1 &&
      !ctx.abortController.signal.aborted
    ) {
      const sanitizedResponseMessages =
        sanitizeToolResponseMessages(newResponseMessages);
      activeInputMessages = [
        ...activeInputMessages,
        ...sanitizedResponseMessages,
        {
          role: "user",
          content:
            "Please continue executing your task and complete your response based on the above tool results.",
        },
      ];
      continue;
    }

    for (let i = passSteps.length - 1; i >= 0; i--) {
      const s = passSteps[i];
      if (s?.text && s.text.trim()) {
        finalText = s.text.trim();
        break;
      }
    }

    if (!finalText && accumulatedStreamText.trim()) {
      finalText = accumulatedStreamText.trim();
    }

    break;
  }

  return { finalText, totalStepsCount, aggregatedUsage };
}
