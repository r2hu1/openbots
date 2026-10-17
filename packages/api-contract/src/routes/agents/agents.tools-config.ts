import { agents, agentTools, db } from "@openbots/db";
import { and, eq } from "drizzle-orm";
import type { ConfigureToolInput } from "./agents.schema.js";
import { ALL_INTERNAL_TOOLS } from "./agents.tools-list.js";

export * from "./agents.tools-list.js";

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
