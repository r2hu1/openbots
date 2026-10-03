import {
  agents,
  agentTools,
  conversations,
  db,
  messages,
  runs,
} from "@openbots/db";
import { tasks } from "@trigger.dev/sdk";
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import {
  getApiKeyForModel,
  getDecryptedUserApiKey,
  getProviderFromModel,
  listUserApiKeys,
} from "../api-keys/api-keys.logic.js";
import { getDirectRunExecutor } from "../runs/runs.logic.js";

import type {
  ConfigureToolInput,
  CreateAgentInput,
  CreateAgentRunInput,
  UpdateAgentInput,
} from "./agents.schema.js";

export async function listAgents(userId: string) {
  const userAgents = await db
    .select({
      ...getTableColumns(agents),
      lastMessage: sql<string | null>`(
        SELECT coalesce(m.content->>'text', m.content->>'prompt', '')
        FROM ${conversations} c
        JOIN ${messages} m ON m.conversation_id = c.id
        WHERE c.agent_id = "agents"."id"
        ORDER BY m.created_at DESC
        LIMIT 1
      )`.as("last_message"),
    })
    .from(agents)
    .where(eq(agents.userId, userId))
    .orderBy(desc(agents.createdAt));
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

export async function getAgentSummary(id: string) {
  const [agent] = await db
    .select({
      name: agents.name,
      description: agents.description,
    })
    .from(agents)
    .where(eq(agents.id, id));
  return agent ?? null;
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
  "manage_schedule",
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
        input: data.prompt ? { prompt: data.prompt } : (data.input ?? null),
      })
      .returning(),
    conversationId && data.prompt
      ? db
          .insert(messages)
          .values({
            conversationId,
            role: "user",
            content: { text: data.prompt },
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

async function fetchLiveGoogleModels(
  apiKey: string,
): Promise<AvailableModel[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      models?: Array<{
        name: string;
        displayName?: string;
        description?: string;
        supportedGenerationMethods?: string[];
      }>;
    };
    if (!data?.models) return [];
    return data.models
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => {
        const cleanId = m.name.replace("models/", "");
        return {
          id: `google/${cleanId}`,
          displayName: m.displayName || cleanId,
          description: m.description,
          provider: "google",
        };
      });
  } catch (err) {
    console.warn("Failed to fetch live Google models:", err);
    return [];
  }
}

async function fetchLiveOpenAICompatibleModels(
  provider: "openai" | "openrouter" | "groq" | "xai" | "deepseek",
  apiKey: string,
  url: string,
): Promise<AvailableModel[]> {
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: Array<{ id: string; name?: string; description?: string }>;
    };
    if (!data?.data || !Array.isArray(data.data)) return [];

    let filtered = data.data;

    // Filter relevant models for OpenAI
    if (provider === "openai") {
      filtered = filtered.filter(
        (m) =>
          (m.id.startsWith("gpt-") ||
            m.id.startsWith("o1") ||
            m.id.startsWith("o3") ||
            m.id.startsWith("chatgpt")) &&
          !m.id.includes("realtime") &&
          !m.id.includes("audio") &&
          !m.id.includes("transcription"),
      );
    }

    return filtered.map((m) => ({
      id: `${provider}/${m.id}`,
      displayName: m.name || m.id,
      description: m.description,
      provider,
    }));
  } catch (err) {
    console.warn(`Failed to fetch live models for ${provider}:`, err);
    return [];
  }
}

async function fetchLiveAnthropicModels(
  apiKey: string,
): Promise<AvailableModel[]> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: Array<{ id: string; display_name?: string }>;
    };
    if (!data?.data || !Array.isArray(data.data)) return [];
    return data.data.map((m) => ({
      id: `anthropic/${m.id}`,
      displayName: m.display_name || m.id,
      provider: "anthropic",
    }));
  } catch (err) {
    console.warn("Failed to fetch live Anthropic models:", err);
    return [];
  }
}

export type AvailableModel = {
  id: string;
  displayName: string;
  description?: string;
  provider?: string;
};

export async function listAvailableModels(userId?: string) {
  if (!userId) {
    return { models: [] };
  }

  // Get user's configured keys
  const userKeysResult = await listUserApiKeys(userId);
  const configuredProviders = new Set(
    userKeysResult.keys.map((k) => k.provider),
  );

  const allModels: AvailableModel[] = [];

  // Fetch in parallel for each configured provider
  const fetchPromises: Array<Promise<AvailableModel[]>> = [];

  if (configuredProviders.has("google")) {
    fetchPromises.push(
      (async () => {
        const key = await getDecryptedUserApiKey(userId, "google");
        if (!key) return [];
        const live = await fetchLiveGoogleModels(key);
        if (live.length > 0) return live;
        return [
          {
            id: "google/gemini-2.5-flash",
            displayName: "Gemini 2.5 Flash",
            provider: "google",
          },
          {
            id: "google/gemini-2.5-pro",
            displayName: "Gemini 2.5 Pro",
            provider: "google",
          },
          {
            id: "google/gemini-2.0-flash",
            displayName: "Gemini 2.0 Flash",
            provider: "google",
          },
        ];
      })(),
    );
  }

  if (configuredProviders.has("openai")) {
    fetchPromises.push(
      (async () => {
        const key = await getDecryptedUserApiKey(userId, "openai");
        if (!key) return [];
        const live = await fetchLiveOpenAICompatibleModels(
          "openai",
          key,
          "https://api.openai.com/v1/models",
        );
        if (live.length > 0) return live;
        return [
          { id: "openai/gpt-4o", displayName: "GPT-4o", provider: "openai" },
          {
            id: "openai/gpt-4o-mini",
            displayName: "GPT-4o mini",
            provider: "openai",
          },
          { id: "openai/o3-mini", displayName: "o3-mini", provider: "openai" },
        ];
      })(),
    );
  }

  if (configuredProviders.has("anthropic")) {
    fetchPromises.push(
      (async () => {
        const key = await getDecryptedUserApiKey(userId, "anthropic");
        if (!key) return [];
        const live = await fetchLiveAnthropicModels(key);
        if (live.length > 0) return live;
        return [
          {
            id: "anthropic/claude-3-7-sonnet",
            displayName: "Claude 3.7 Sonnet",
            provider: "anthropic",
          },
          {
            id: "anthropic/claude-3-5-sonnet",
            displayName: "Claude 3.5 Sonnet",
            provider: "anthropic",
          },
          {
            id: "anthropic/claude-3-5-haiku",
            displayName: "Claude 3.5 Haiku",
            provider: "anthropic",
          },
        ];
      })(),
    );
  }

  if (configuredProviders.has("deepseek")) {
    fetchPromises.push(
      (async () => {
        const key = await getDecryptedUserApiKey(userId, "deepseek");
        if (!key) return [];
        const live = await fetchLiveOpenAICompatibleModels(
          "deepseek",
          key,
          "https://api.deepseek.com/v1/models",
        );
        if (live.length > 0) return live;
        return [
          {
            id: "deepseek/deepseek-chat",
            displayName: "DeepSeek V3",
            provider: "deepseek",
          },
          {
            id: "deepseek/deepseek-reasoner",
            displayName: "DeepSeek R1",
            provider: "deepseek",
          },
        ];
      })(),
    );
  }

  if (configuredProviders.has("groq")) {
    fetchPromises.push(
      (async () => {
        const key = await getDecryptedUserApiKey(userId, "groq");
        if (!key) return [];
        const live = await fetchLiveOpenAICompatibleModels(
          "groq",
          key,
          "https://api.groq.com/openai/v1/models",
        );
        if (live.length > 0) return live;
        return [
          {
            id: "groq/llama-3.3-70b-versatile",
            displayName: "Llama 3.3 70B",
            provider: "groq",
          },
        ];
      })(),
    );
  }

  if (configuredProviders.has("xai")) {
    fetchPromises.push(
      (async () => {
        const key = await getDecryptedUserApiKey(userId, "xai");
        if (!key) return [];
        const live = await fetchLiveOpenAICompatibleModels(
          "xai",
          key,
          "https://api.x.ai/v1/models",
        );
        if (live.length > 0) return live;
        return [{ id: "xai/grok-2", displayName: "Grok 2", provider: "xai" }];
      })(),
    );
  }

  if (configuredProviders.has("openrouter")) {
    fetchPromises.push(
      (async () => {
        const key = await getDecryptedUserApiKey(userId, "openrouter");
        if (!key) return [];
        const live = await fetchLiveOpenAICompatibleModels(
          "openrouter",
          key,
          "https://openrouter.ai/api/v1/models",
        );
        if (live.length > 0) return live;
        return [
          {
            id: "openrouter/auto",
            displayName: "OpenRouter Auto",
            provider: "openrouter",
          },
        ];
      })(),
    );
  }

  const results = await Promise.all(fetchPromises);
  for (const list of results) {
    allModels.push(...list);
  }

  return {
    models: allModels,
  };
}
