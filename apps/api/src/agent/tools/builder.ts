import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { jsonSchema, tool } from "ai";
import { and, eq } from "drizzle-orm";
import { createDaytonaTools } from "@openbots/api-contract/daytona";
import { agents, agentTools, connections, db } from "@openbots/db";

import { internalTools } from "./internal-registry.js";
import { createScheduleTool } from "./schedule-creator.js";
import { createRecurringTaskTool } from "./schedule-recurring.js";
import { getTaskHistoryTool } from "./schedule-history.js";
import { manageScheduleTool } from "./schedule-manager.js";
import { createDownloadableFileTool } from "./document-downloadable.js";
import { createReactToMessageTool } from "./react-tool.js";
import { createMemoryTools } from "./memory-tools.js";
import { createChatHistoryTool } from "./chat-history-tool.js";

export interface ResolvedTools {
  tools: Record<string, any>;
  cleanup: () => Promise<void>;
}

export async function buildAgentTools(params: {
  userId: string;
  agentId: string;
  conversationId?: string | null;
}): Promise<ResolvedTools> {
  const { userId, agentId, conversationId } = params;

  const memoryTools = createMemoryTools(userId, agentId);

  const activeTools: Record<string, any> = {
    create_schedule: createScheduleTool(userId, agentId, conversationId),
    create_recurring_task: createRecurringTaskTool(userId, agentId, conversationId),
    get_task_history: getTaskHistoryTool(userId, agentId),
    manage_schedule: manageScheduleTool(userId, agentId, conversationId),
    react_to_message: createReactToMessageTool(conversationId),
    create_downloadable_file: createDownloadableFileTool(userId),
    search_memory: memoryTools.search_memory,
    save_memory: memoryTools.save_memory,
    delete_memory: memoryTools.delete_memory,
    get_chat_history: createChatHistoryTool(conversationId),
  };
  const cleanupTasks: Array<() => Promise<void>> = [];

  const composioApiKey = process.env.COMPOSIO_API_KEY;
  if (composioApiKey) {
    try {
      const composio = new Composio({
        apiKey: composioApiKey,
        provider: new VercelProvider(),
      });

      const [existingConn] = await db
        .select()
        .from(connections)
        .where(
          and(
            eq(connections.userId, userId),
            eq(connections.provider, "composio"),
            eq(connections.status, "active"),
          ),
        );

      let session: any = null;
      if (existingConn?.externalAccountId) {
        try {
          session = await composio.use(existingConn.externalAccountId);
        } catch {
          session = null;
        }
      }

      if (!session) {
        session = await composio.create(userId, {
          sandbox: { enable: false },
          manageConnections: true,
        });

        if (existingConn) {
          await db
            .update(connections)
            .set({
              externalAccountId: session.sessionId,
              updatedAt: new Date(),
            })
            .where(eq(connections.id, existingConn.id));
        } else {
          await db.insert(connections).values({
            userId,
            provider: "composio",
            externalAccountId: session.sessionId,
            status: "active",
          });
        }
      }

      const composioTools = await session.tools();
      if (Array.isArray(composioTools)) {
        for (const t of composioTools) {
          if (t && typeof t === "object" && "name" in t) {
            activeTools[t.name] = t;
          }
        }
      } else if (composioTools && typeof composioTools === "object") {
        for (const [key, value] of Object.entries(composioTools)) {
          if (value) {
            activeTools[key] = value;
          }
        }
      }
    } catch (err) {
      console.warn("Failed to initialize Composio session:", err);
    }
  }

  const [agentRecord] = await db
    .select({ sandboxId: agents.sandboxId, name: agents.name })
    .from(agents)
    .where(eq(agents.id, agentId));

  const desktopContextKey = conversationId || agentId || userId;
  const desktopTools = createDaytonaTools({
    sandboxId: agentRecord?.sandboxId,
    agentId,
    agentName: agentRecord?.name,
    contextKey: desktopContextKey,
  });

  const allConfigs = await db
    .select()
    .from(agentTools)
    .where(eq(agentTools.agentId, agentId));
  const toolStateMap = new Map(allConfigs.map((t) => [t.toolName, t]));

  for (const [name, toolInstance] of Object.entries(internalTools)) {
    const cfg = toolStateMap.get(name);
    if (!cfg || cfg.enabled) {
      activeTools[name] = toolInstance;
    }
  }

  for (const [name, toolInstance] of Object.entries(desktopTools)) {
    const cfg = toolStateMap.get(name);
    if (!cfg || cfg.enabled) {
      activeTools[name] = toolInstance;
    }
  }

  for (const config of allConfigs) {
    if (!config.enabled) continue;
    if (config.provider === "mcp") {
      const mcpConfig = config.config as { url?: string } | null;
      if (!mcpConfig?.url) {
        throw new Error(
          `MCP tool '${config.toolName}' requires a server URL in configuration`,
        );
      }

      const client = new Client({
        name: "openbots-agent",
        version: "1.0.0",
      });

      const transport = new StreamableHTTPClientTransport(
        new URL(mcpConfig.url),
      );
      await client.connect(transport);
      cleanupTasks.push(async () => {
        try {
          await client.close();
        } catch {
          // Ignore transport close errors
        }
      });

      const { tools: mcpToolsList } = await client.listTools();
      const targetMcpTool = mcpToolsList.find(
        (t) => t.name === config.toolName,
      );

      if (targetMcpTool) {
        activeTools[config.toolName] = tool({
          description: targetMcpTool.description ?? "",
          inputSchema: jsonSchema(targetMcpTool.inputSchema as any),
          execute: async (args: any) => {
            return await client.callTool({
              name: targetMcpTool.name,
              arguments: args,
            });
          },
        });
      }
    }
  }

  return {
    tools: activeTools,
    cleanup: async () => {
      for (const cleanup of cleanupTasks) {
        await cleanup();
      }
    },
  };
}
