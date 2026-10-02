import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { agents, db, messages, runSteps, runs } from "@openbots/db";
import { stepCountIs, ToolLoopAgent } from "ai";
import { and, asc, eq, inArray } from "drizzle-orm";
import { buildAgentTools } from "./tools.js";

function getGoogleClient() {
  const apiKey =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY environment variable is required",
    );
  }
  return createGoogleGenerativeAI({ apiKey });
}

function resolveModel(modelName: string) {
  let normalized = modelName;
  if (normalized.startsWith("google/")) {
    normalized = normalized.replace("google/", "");
  } else if (normalized.startsWith("openai/") || normalized === "default") {
    normalized = "gemini-2.5-flash";
  }
  const client = getGoogleClient();
  return client(normalized);
}

export function sanitizeErrorMessage(error: unknown): string {
  if (!error) return "Unknown error during execution";
  const rawMessage = error instanceof Error ? error.message : String(error);
  // Redact potential API keys, connection strings, and secrets
  return rawMessage
    .replace(/AIzaSy[a-zA-Z0-9_-]{20,}/g, "[REDACTED_GEMINI_KEY]")
    .replace(/tr_(dev|prod)_[a-zA-Z0-9_-]{20,}/g, "[REDACTED_TRIGGER_KEY]")
    .replace(/sk-[a-zA-Z0-9_-]{20,}/g, "[REDACTED_API_KEY]")
    .replace(/Bearer\s+[a-zA-Z0-9_.-]+/gi, "Bearer [REDACTED_TOKEN]")
    .replace(
      /postgres(ql)?:\/\/[^:]+:([^@]+)@/gi,
      "postgresql://[REDACTED_USER]:[REDACTED_PASSWORD]@",
    )
    .replace(
      /(api[_-]?key|token|secret|password)\s*[:=]\s*['"][^'"]+['"]/gi,
      "$1=[REDACTED]",
    );
}

export async function executeAgentRun(
  runId: string,
  options?: { signal?: AbortSignal },
) {
  // If already aborted before execution start, transition directly to cancelled
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

    if (cancelledRun) return cancelledRun;
    const [existing] = await db.select().from(runs).where(eq(runs.id, runId));
    return existing ?? { id: runId, status: "cancelled" };
  }

  // 1. Concurrency-safe atomic claim from queued -> running
  const [claimedRun] = await db
    .update(runs)
    .set({
      status: "running",
      startedAt: new Date(),
    })
    .where(and(eq(runs.id, runId), eq(runs.status, "queued")))
    .returning();

  if (!claimedRun) {
    // Run was already claimed, cancelled, or finished by another worker/request
    const [existingRun] = await db
      .select()
      .from(runs)
      .where(eq(runs.id, runId));

    if (!existingRun) {
      throw new Error(`Run not found: ${runId}`);
    }

    // Terminal states (completed, failed, cancelled) or active running state:
    // Do NOT start another model/tool loop.
    return existingRun;
  }

  const runRecord = claimedRun;

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

  // Validate agent ownership
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

  // Validate autonomy: only manual is currently supported
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

  // Set up cooperative AbortController
  const abortController = new AbortController();
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
    // Check if cancellation occurred before tool setup
    if (abortController.signal.aborted) {
      const [cancelledRun] = await db
        .update(runs)
        .set({
          status: "cancelled",
          completedAt: new Date(),
        })
        .where(and(eq(runs.id, runId), eq(runs.status, "running")))
        .returning();
      const [current] = await db.select().from(runs).where(eq(runs.id, runId));
      return cancelledRun ?? current ?? runRecord;
    }

    // Clear any previous partial steps if this run is being retried
    await db.delete(runSteps).where(eq(runSteps.runId, runId));

    resolvedTools = await buildAgentTools({
      userId: runRecord.userId,
      agentId: agentRecord.id,
      conversationId: runRecord.conversationId,
    });

    // Prepare conversation messages
    const inputMessages: Array<{
      role: "user" | "assistant" | "system";
      content: string;
    }> = [];

    if (runRecord.conversationId) {
      const history = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, runRecord.conversationId))
        .orderBy(asc(messages.createdAt));

      for (const m of history) {
        if (
          m.role === "user" ||
          m.role === "assistant" ||
          m.role === "system"
        ) {
          let textContent = "";
          if (typeof m.content === "string") {
            textContent = m.content;
          } else if (m.content && typeof m.content === "object") {
            textContent =
              (m.content as any).text ??
              (m.content as any).prompt ??
              JSON.stringify(m.content);
          }
          inputMessages.push({
            role: m.role,
            content: textContent,
          });
        }
      }
    }

    // Add current run input
    const inputObj = runRecord.input as any;
    const promptText =
      typeof inputObj === "string"
        ? inputObj
        : (inputObj?.prompt ??
          inputObj?.text ??
          (inputObj?.messages ? null : JSON.stringify(inputObj ?? "")));

    if (promptText) {
      inputMessages.push({
        role: "user",
        content: promptText,
      });

      // If tied to a conversation, check if already persisted (e.g. at route trigger time)
      if (runRecord.conversationId) {
        const [existing] = await db
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, runRecord.conversationId),
              eq(messages.role, "user"),
            ),
          )
          .limit(1);

        if (!existing) {
          await db.insert(messages).values({
            conversationId: runRecord.conversationId,
            role: "user",
            content: { text: promptText },
          });
        }
      }
    } else if (Array.isArray(inputObj?.messages)) {
      for (const m of inputObj.messages) {
        inputMessages.push(m);
      }
    }

    // Construct ToolLoopAgent using AI SDK
    const model = resolveModel(agentRecord.model);
    const systemInstructions = `${agentRecord.instructions || "You are an AI assistant."}

## Scheduling & Reminders:
- You have access to the 'create_schedule' tool.
- ALWAYS use 'create_schedule' whenever the user asks for a reminder, alarm, delayed task, or recurring execution (e.g. "remind me in 1 minute to have tea", "schedule a check in 2 hours", "run every Monday at 9am").
- For one-off reminders/delays, specify type="delay" with delaySeconds (e.g. 60 for 1 minute).
- NEVER prompt the user to connect external services (like Slack, Google Calendar, or Notion) for reminders or timers unless they specifically ask to be notified on that external app.`;

    const agent = new ToolLoopAgent({
      model,
      instructions: systemInstructions,
      tools: resolvedTools.tools,
      stopWhen: stepCountIs(agentRecord.maxSteps ?? 10),
    });

    let currentStepNumber = 0;

    const result = await agent.generate({
      messages: inputMessages as any,
      abortSignal: abortController.signal,
      onStepFinish: async (step) => {
        // Cooperative DB cancellation check between steps
        const [liveRun] = await db
          .select({ status: runs.status })
          .from(runs)
          .where(eq(runs.id, runRecord.id));

        if (liveRun?.status === "cancelled") {
          abortController.abort(new Error("Run was cancelled"));
          return;
        }

        try {
          // Record model step
          await db.insert(runSteps).values({
            runId: runRecord.id,
            stepNumber: currentStepNumber++,
            type: "model",
            status: "completed",
            model: agentRecord.model,
            output: {
              text: step.text,
              finishReason: step.finishReason,
              usage: step.usage,
            },
          });

          // Record any tool execution steps
          if (step.toolResults && step.toolResults.length > 0) {
            for (const tr of step.toolResults) {
              await db.insert(runSteps).values({
                runId: runRecord.id,
                stepNumber: currentStepNumber++,
                type: "tool",
                status: "completed",
                toolName: tr.toolName,
                toolCallId: tr.toolCallId,
                toolInput: ((tr as any).input ??
                  (tr as any).args ??
                  null) as any,
                toolOutput: ((tr as any).output ??
                  (tr as any).result ??
                  null) as any,
              });
            }
          }
        } catch (stepErr) {
          console.warn("Failed to persist run step metadata:", stepErr);
        }
      },
    });

    const finalOutput = {
      text: result.text,
      steps: result.steps?.length ?? 0,
      usage: result.usage,
    };

    // Conditional completion update: ONLY complete if run is still in 'running' state.
    // If run was cancelled while model was finishing, this update affects 0 rows.
    const [completedRun] = await db
      .update(runs)
      .set({
        status: "completed",
        output: finalOutput,
        completedAt: new Date(),
      })
      .where(and(eq(runs.id, runId), eq(runs.status, "running")))
      .returning();

    if (!completedRun) {
      // Race: run was cancelled or modified concurrently
      const [finalRun] = await db.select().from(runs).where(eq(runs.id, runId));
      return (
        finalRun ?? { id: runId, status: "cancelled", output: finalOutput }
      );
    }

    // If part of conversation, persist assistant's final response
    if (runRecord.conversationId && result.text) {
      await db.insert(messages).values({
        conversationId: runRecord.conversationId,
        role: "assistant",
        content: { text: result.text },
      });
    }

    return completedRun;
  } catch (error) {
    // Check if run was cancelled in DB or aborted
    const [currentRun] = await db.select().from(runs).where(eq(runs.id, runId));

    if (currentRun?.status === "cancelled" || abortController.signal.aborted) {
      // Ensure DB status is cancelled if not already marked
      if (currentRun?.status !== "cancelled") {
        await db
          .update(runs)
          .set({
            status: "cancelled",
            completedAt: new Date(),
          })
          .where(and(eq(runs.id, runId), eq(runs.status, "running")));
      }
      const [finalRun] = await db.select().from(runs).where(eq(runs.id, runId));
      return finalRun ?? currentRun;
    }

    // Conditional failure update: only mark failed if still running
    const safeError = sanitizeErrorMessage(error);
    await db
      .update(runs)
      .set({
        status: "failed",
        error: safeError,
        completedAt: new Date(),
      })
      .where(and(eq(runs.id, runId), eq(runs.status, "running")));

    throw new Error(safeError);
  } finally {
    if (resolvedTools) {
      await resolvedTools.cleanup();
    }
  }
}
