import { db, getRedis, messages } from "@openbots/db";
import { tool } from "ai";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

const CHAT_MSG_TTL = 300; // 5 min cache for fast repeated reads

export function createChatHistoryTool(conversationId?: string | null) {
  return tool({
    description:
      "Get or search messages at any point in the current chat/conversation. Use this to inspect earlier messages, retrieve context, look up previous instructions, code snippets, or user questions from earlier in this conversation.",
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe(
          "Optional keyword or phrase to search for across previous messages in this conversation",
        ),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe(
          "Maximum number of messages to retrieve (default: 20, max: 100)",
        ),
      offset: z
        .number()
        .optional()
        .default(0)
        .describe(
          "Number of messages to skip from the beginning/end for pagination",
        ),
      order: z
        .enum(["asc", "desc"])
        .optional()
        .default("desc")
        .describe(
          "Sorting order by time: 'desc' (most recent first) or 'asc' (chronological start first). Defaults to 'desc'.",
        ),
      role: z
        .enum(["user", "assistant", "system", "tool"])
        .optional()
        .describe(
          "Optional role filter: 'user', 'assistant', 'system', or 'tool'",
        ),
    }),
    execute: async ({
      query,
      limit = 20,
      offset = 0,
      order = "desc",
      role,
    }) => {
      if (!conversationId) {
        return {
          success: false,
          error: "No active conversation context.",
        };
      }

      const clampedLimit = Math.min(Math.max(1, limit), 100);

      // Check redis cache for simple recent messages
      const redis = getRedis();
      const cacheKey = `chat:msg:${conversationId}:${order}:${role || "all"}:${clampedLimit}:${offset}`;
      if (!query && redis) {
        try {
          const cached = await redis.get<Record<string, unknown>>(cacheKey);
          if (cached) {
            return cached;
          }
        } catch {
          // ignore cache error
        }
      }

      const conditions = [eq(messages.conversationId, conversationId)];

      if (role) {
        conditions.push(eq(messages.role, role));
      }

      const orderClause =
        order === "asc" ? asc(messages.createdAt) : desc(messages.createdAt);

      const dbRows = await db
        .select({
          id: messages.id,
          role: messages.role,
          content: messages.content,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(and(...conditions))
        .orderBy(orderClause)
        .limit(clampedLimit)
        .offset(offset);

      let filteredRows = dbRows;
      if (query?.trim()) {
        const q = query.toLowerCase();
        filteredRows = dbRows.filter((row) => {
          const contentObj = row.content as Record<string, unknown> | null;
          const text =
            typeof row.content === "string"
              ? row.content
              : (contentObj?.text as string) || JSON.stringify(row.content);
          return text.toLowerCase().includes(q);
        });
      }

      const formatted = filteredRows.map((msg) => {
        let textContent = "";
        if (typeof msg.content === "string") {
          textContent = msg.content;
        } else if (msg.content && typeof msg.content === "object") {
          const c = msg.content as Record<string, unknown>;
          textContent =
            (c.text as string) ||
            (c.prompt as string) ||
            JSON.stringify(msg.content);
        }

        return {
          id: msg.id,
          role: msg.role,
          text: textContent,
          createdAt: msg.createdAt,
        };
      });

      const response = {
        success: true,
        count: formatted.length,
        conversationId,
        messages: formatted,
      };

      if (!query && redis) {
        await redis
          .set(cacheKey, JSON.stringify(response), { ex: CHAT_MSG_TTL })
          .catch(() => {});
      }

      return response;
    },
  });
}
