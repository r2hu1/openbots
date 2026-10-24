import {
  deleteMemory,
  searchMemories,
  setMemory,
} from "@openbots/api-contract";
import { tool } from "ai";
import { z } from "zod";

export function createMemoryTools(userId: string, agentId?: string | null) {
  const search_memory = tool({
    description:
      "Search and retrieve stored memories, user facts, preferences, instructions, or notes from long-term memory across sessions. If query is omitted or empty, lists recent memories.",
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe(
          "Search keywords or topic to match in memory key, category, or content",
        ),
      category: z
        .string()
        .optional()
        .describe(
          "Optional category to filter by (e.g. 'preferences', 'profile', 'work', 'notes')",
        ),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of memories to return (default: 10)"),
    }),
    execute: async ({ query, category, limit }) => {
      try {
        const results = await searchMemories({
          userId,
          agentId,
          query,
          category,
          limit,
        });

        if (results.length === 0) {
          return {
            success: true,
            count: 0,
            message: query
              ? `No memories found matching "${query}".`
              : "No memories found.",
            memories: [],
          };
        }

        return {
          success: true,
          count: results.length,
          memories: results.map((m) => ({
            id: m.id,
            key: m.key,
            content: m.content,
            category: m.category,
            updatedAt: m.updatedAt,
          })),
        };
      } catch (err: unknown) {
        return {
          success: false,
          error:
            err instanceof Error ? err.message : "Failed to search memories",
        };
      }
    },
  });

  const save_memory = tool({
    description:
      "Save or update a fact, preference, user instruction, or piece of knowledge into long-term memory. Overwrites if a memory with the same key already exists.",
    inputSchema: z.object({
      key: z
        .string()
        .min(1)
        .describe(
          "Unique semantic identifier for this memory, e.g. 'user_tech_stack', 'user_timezone', 'user_nickname'",
        ),
      content: z
        .string()
        .min(1)
        .describe(
          "The actual information, fact, or instruction to remember permanently",
        ),
      category: z
        .string()
        .optional()
        .default("general")
        .describe(
          "Category for organizing memories (e.g. 'preferences', 'profile', 'tech_stack', 'projects')",
        ),
    }),
    execute: async ({ key, content, category }) => {
      try {
        const memory = await setMemory({
          userId,
          agentId,
          key,
          content,
          category,
        });

        return {
          success: true,
          message: `Memory saved successfully under key '${key}'.`,
          memory: {
            id: memory.id,
            key: memory.key,
            content: memory.content,
            category: memory.category,
            updatedAt: memory.updatedAt,
          },
        };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to save memory",
        };
      }
    },
  });

  const delete_memory_tool = tool({
    description:
      "Permanently delete a memory by key or ID if outdated, invalidated, or no longer relevant.",
    inputSchema: z.object({
      keyOrId: z
        .string()
        .min(1)
        .describe("The key or ID of the memory to remove"),
    }),
    execute: async ({ keyOrId }) => {
      try {
        const deleted = await deleteMemory(userId, keyOrId);
        if (!deleted) {
          return {
            success: false,
            message: `Memory '${keyOrId}' not found.`,
          };
        }
        return {
          success: true,
          message: `Memory '${keyOrId}' deleted successfully.`,
        };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to delete memory",
        };
      }
    },
  });

  return {
    search_memory,
    save_memory,
    delete_memory: delete_memory_tool,
  };
}
