import {
  agentTools,
  agents,
  conversations,
  db,
  messages,
  runs,
} from "@openbots/db";
import { tasks } from "@trigger.dev/sdk";
import { and, eq } from "drizzle-orm";
import { getDirectRunExecutor } from "../runs/runs.logic.js";
import type {
  ConfigureToolInput,
  CreateAgentInput,
  CreateAgentRunInput,
  UpdateAgentInput,
} from "./agents.schema.js";

export async function listAgents(userId: string) {
  const userAgents = await db
    .select()
    .from(agents)
    .where(eq(agents.userId, userId));
  return { agents: userAgents };
}

export async function getAgent(id: string, userId: string) {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, userId)));
  if (!agent) {
    return null;
  }
  return { agent };
}

export async function createAgent(userId: string, data: CreateAgentInput) {
  const [agent] = await db
    .insert(agents)
    .values({
      userId,
      name: data.name,
      description: data.description,
      instructions: data.instructions,
      model: data.model,
      maxSteps: data.maxSteps,
      autonomy: data.autonomy,
      status: "active",
    })
    .returning();

  // Automatically enable all default internal tools for newly created agents
  if (agent) {
    await db.insert(agentTools).values(
      ALL_INTERNAL_TOOLS.map((toolName) => ({
        agentId: agent.id,
        provider: "internal" as const,
        toolName,
        enabled: true,
      })),
    );
  }

  return { agent };
}

export async function updateAgent(
  id: string,
  userId: string,
  data: UpdateAgentInput,
) {
  const [updated] = await db
    .update(agents)
    .set({
      ...(data.name ? { name: data.name } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      ...(data.instructions ? { instructions: data.instructions } : {}),
      ...(data.model ? { model: data.model } : {}),
      ...(data.maxSteps ? { maxSteps: data.maxSteps } : {}),
      ...(data.autonomy ? { autonomy: data.autonomy } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(agents.id, id), eq(agents.userId, userId)))
    .returning();

  if (!updated) {
    return null;
  }
  return { agent: updated };
}

export async function deleteAgent(id: string, userId: string) {
  const [deleted] = await db
    .delete(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, userId)))
    .returning();

  if (!deleted) {
    return null;
  }
  return { agent: deleted };
}

export const ALL_INTERNAL_TOOLS = [
  "get_current_time",
  "calculate",
  "create_schedule",
  "web_search",
  "fetch_web_page",
  "http_request",
  "json_parser",
  "text_analyzer",
  "execute_code",
  "generate_uuid",
  "transform_text",
  "unit_converter",
  "random_generator",
  "get_weather",
  "wikipedia_search",
  "currency_converter",
  "dns_lookup",
] as const;

export async function getAgentTools(agentId: string, userId: string) {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, userId)));

  if (!agent) {
    return null;
  }

  const configured = await db
    .select()
    .from(agentTools)
    .where(eq(agentTools.agentId, agentId));

  const configuredMap = new Map(configured.map((t) => [t.toolName, t]));

  // Ensure all standard internal tools appear in the list with their actual configured or default state
  const mergedTools: typeof configured = [];

  for (const internalName of ALL_INTERNAL_TOOLS) {
    const existing = configuredMap.get(internalName);
    if (existing) {
      mergedTools.push(existing);
      configuredMap.delete(internalName);
    } else {
      mergedTools.push({
        id: `virtual-${internalName}`,
        agentId,
        provider: "internal",
        toolName: internalName,
        enabled: true, // Default enabled for all standard internal capabilities
        config: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
    }
  }

  // Append any remaining custom/mcp/composio tools
  for (const remaining of configuredMap.values()) {
    mergedTools.push(remaining);
  }

  return { tools: mergedTools };
}

export async function toggleAgentTool(
  agentId: string,
  userId: string,
  data: ConfigureToolInput,
) {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, userId)));

  if (!agent) {
    return null;
  }

  const [existing] = await db
    .select()
    .from(agentTools)
    .where(
      and(
        eq(agentTools.agentId, agentId),
        eq(agentTools.toolName, data.toolName),
      ),
    );

  if (existing) {
    const [updated] = await db
      .update(agentTools)
      .set({
        enabled: data.enabled,
        config: data.config !== undefined ? data.config : existing.config,
        updatedAt: new Date(),
      })
      .where(eq(agentTools.id, existing.id))
      .returning();
    return { tool: updated };
  } else {
    const [inserted] = await db
      .insert(agentTools)
      .values({
        agentId,
        provider: data.provider,
        toolName: data.toolName,
        enabled: data.enabled,
        config: data.config ?? null,
      })
      .returning();
    return { tool: inserted };
  }
}

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

  const [run] = await db
    .insert(runs)
    .values({
      userId,
      agentId: agent.id,
      conversationId,
      status: "queued",
      triggerType: "manual",
      input: data.prompt ? { prompt: data.prompt } : (data.input ?? null),
    })
    .returning();

  if (!run) {
    return { error: "Failed to create run", status: 500 as const };
  }

  // Immediately persist user message into conversation so it is instantly available
  if (conversationId && data.prompt) {
    try {
      await db.insert(messages).values({
        conversationId,
        role: "user",
        content: { text: data.prompt },
      });
    } catch (err) {
      console.warn("Could not immediately persist user message:", err);
    }
  }

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

export async function listAvailableModels() {
  const apiKey =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (apiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      );
      if (res.ok) {
        const data = (await res.json()) as {
          models?: Array<{
            name: string;
            displayName?: string;
            description?: string;
            supportedGenerationMethods?: string[];
          }>;
        };

        if (data?.models && data.models.length > 0) {
          const contentModels = data.models
            .filter((m) =>
              m.supportedGenerationMethods?.includes("generateContent"),
            )
            .map((m) => {
              const cleanId = m.name.replace("models/", "");
              return {
                id: `google/${cleanId}`,
                displayName: m.displayName || cleanId,
                description: m.description,
              };
            });

          if (contentModels.length > 0) {
            return { models: contentModels };
          }
        }
      }
    } catch (err) {
      console.warn("Failed to fetch live Gemini models, using defaults:", err);
    }
  }

  return {
    models: [
      {
        id: "google/gemini-2.5-flash",
        displayName: "Gemini 2.5 Flash",
        description: "Fast multimodal reasoning and coding",
      },
      {
        id: "google/gemini-2.5-pro",
        displayName: "Gemini 2.5 Pro",
        description: "Advanced reasoning for complex multi-step tasks",
      },
      {
        id: "google/gemini-2.0-flash",
        displayName: "Gemini 2.0 Flash",
        description: "High speed multimodal model",
      },
      {
        id: "google/gemini-2.0-flash-lite",
        displayName: "Gemini 2.0 Flash-Lite",
        description: "Cost-efficient, low latency tasks",
      },
      {
        id: "google/gemini-1.5-flash",
        displayName: "Gemini 1.5 Flash",
        description: "1M token context lightweight model",
      },
      {
        id: "google/gemini-1.5-pro",
        displayName: "Gemini 1.5 Pro",
        description: "High-capacity reasoning with 2M token context",
      },
    ],
  };
}
