import {
  agents,
  conversations,
  db,
  messages,
  runs,
} from "@openbots/db";
import { tasks } from "@trigger.dev/sdk";
import { and, eq } from "drizzle-orm";
import {
  getApiKeyForModel,
  getProviderFromModel,
} from "../api-keys/api-keys.logic.js";
import { agentEventHub, getDirectRunExecutor } from "../runs/runs.logic.js";
import type { CreateAgentRunInput } from "./agents.schema.js";

export async function createAgentRun(
  userId: string,
  agentId: string,
  data: CreateAgentRunInput,
) {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, userId)));

  if (!agent) {
    return { error: "Agent not found or unauthorized", status: 404 as const };
  }

  // Check if API key is configured for this agent's model
  const apiKey = await getApiKeyForModel(userId, agent.model);
  if (!apiKey) {
    const provider = getProviderFromModel(agent.model) || agent.model;
    return {
      error: `No API key configured for ${provider}. Please add your ${provider} API key in Settings > API Keys to send messages.`,
      status: 400 as const,
    };
  }

  let conversationId = data.conversationId;
  if (!conversationId) {
    const [conv] = await db
      .insert(conversations)
      .values({
        userId,
        agentId: agent.id,
        title: data.prompt ? data.prompt.slice(0, 60) : "New Conversation",
      })
      .returning();
    conversationId = conv?.id;
  }

  const hasUserMessage = !!(
    data.prompt ||
    (data.images && data.images.length > 0) ||
    (data.attachments && data.attachments.length > 0)
  );
  const userContent = {
    text: data.prompt || "",
    ...(data.images && data.images.length > 0 ? { images: data.images } : {}),
    ...(data.attachments && data.attachments.length > 0
      ? { attachments: data.attachments }
      : {}),
  };

  const runInput = hasUserMessage
    ? {
        ...userContent,
        ...(data.clientContext ? { clientContext: data.clientContext } : {}),
      }
    : typeof data.input === "object" && data.input !== null
      ? {
          ...data.input,
          ...(data.clientContext ? { clientContext: data.clientContext } : {}),
        }
      : (data.input ?? (data.clientContext ? { clientContext: data.clientContext } : null));

  // Parallelize run and user message insertion
  const [[run]] = await Promise.all([
    db
      .insert(runs)
      .values({
        userId,
        agentId: agent.id,
        conversationId,
        status: "queued",
        triggerType: "manual",
        input: runInput,
      })
      .returning(),
    conversationId && hasUserMessage
      ? db
          .insert(messages)
          .values({
            conversationId,
            role: "user",
            content: userContent,
          })
          .catch((err) => {
            console.warn("Could not immediately persist user message:", err);
            return null;
          })
      : Promise.resolve(null),
  ]);

  if (!run) {
    return { error: "Failed to create run", status: 500 as const };
  }

  // Broadcast run_created in realtime to all agent stream listeners and user workspace stream
  agentEventHub.publish(
    agent.id,
    {
      type: "run_created",
      run,
    },
    userId,
  );

  // Fast path: if direct executor is registered in this process (API server), start execution immediately
  const directExecutor = getDirectRunExecutor();
  if (directExecutor) {
    directExecutor(run.id).catch((err) => {
      console.error("Direct run execution error:", err);
    });
  } else {
    // Enqueue durable task with Trigger.dev with idempotency deduplication
    try {
      await tasks.trigger(
        "agent-run",
        { runId: run.id },
        {
          idempotencyKey: run.id,
          tags: [run.id, userId],
        },
      );
    } catch (err) {
      console.warn("Could not dispatch Trigger.dev task for run:", run.id, err);
    }
  }

  return {
    run: {
      id: run.id,
      status: run.status,
      conversationId: run.conversationId,
    },
    status: 201 as const,
  };
}
