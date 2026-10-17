import {
  agents,
  agentTools,
  conversations,
  db,
  messages,
} from "@openbots/db";
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { ALL_INTERNAL_TOOLS } from "./agents.tools-list.js";
import type {
  CreateAgentInput,
  UpdateAgentInput,
} from "./agents.schema.js";

export * from "./agents.runs.js";

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

  if (agent) {
    // Automatically enable all default internal tools for newly created agents
    await db.insert(agentTools).values(
      ALL_INTERNAL_TOOLS.map((toolName) => ({
        agentId: agent.id,
        provider: "internal" as const,
        toolName,
        enabled: true,
      })),
    );

    // Create an isolated Daytona sandbox for the agent if configured
    try {
      const { createAgentSandbox } = await import("../../daytona/sandbox.js");
      const sandboxId = await createAgentSandbox(agent.name);
      if (sandboxId) {
        await db
          .update(agents)
          .set({ sandboxId })
          .where(eq(agents.id, agent.id));
        agent.sandboxId = sandboxId;
      }
    } catch (err) {
      console.warn("Failed to create Daytona sandbox for agent:", err);
    }
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
  // Retrieve agent to inspect sandboxId before deletion
  const [existing] = await db
    .select({ id: agents.id, sandboxId: agents.sandboxId })
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, userId)));

  if (existing?.sandboxId) {
    // Asynchronously delete the Daytona sandbox
    import("../../daytona/sandbox.js")
      .then(({ deleteAgentSandbox }) => deleteAgentSandbox(existing.sandboxId!))
      .catch((err) => console.warn("Failed to delete Daytona sandbox:", err));
  }

  const [deleted] = await db
    .delete(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, userId)))
    .returning();

  if (!deleted) {
    return null;
  }
  return { agent: deleted };
}
