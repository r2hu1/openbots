import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { tool } from "ai";
import { db, messages } from "@openbots/db";

export function createReactToMessageTool(conversationId?: string | null) {
  return tool({
    description:
      "React with an emoji (e.g. 👍, ❤️, 🎉, 🔥, 👀, 🚀, 💡, 👏, 🤖) to a user's message in the current conversation. ONLY use this when naturally appropriate (e.g. when acknowledging a great prompt, celebrating a milestone, or appreciating positive feedback). Do NOT overuse.",
    inputSchema: z.object({
      emoji: z
        .string()
        .describe(
          "The emoji symbol to react with, e.g. 👍, ❤️, 🎉, 🔥, 👀, 🚀, 💡, 👏, 🤖",
        ),
      messageId: z
        .string()
        .optional()
        .describe(
          "Optional specific user message ID to react to. If omitted, reacts to the latest user message in the conversation.",
        ),
    }),
    execute: async ({ emoji, messageId }) => {
      if (!conversationId) {
        return { success: false, error: "No active conversation" };
      }

      let targetMessageId = messageId;
      if (!targetMessageId) {
        const [latestUserMsg] = await db
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, conversationId),
              eq(messages.role, "user"),
            ),
          )
          .orderBy(desc(messages.createdAt))
          .limit(1);

        if (!latestUserMsg) {
          return { success: false, error: "No user message found to react to" };
        }
        targetMessageId = latestUserMsg.id;
      }

      const [targetMsg] = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.id, targetMessageId),
            eq(messages.conversationId, conversationId),
          ),
        );

      if (!targetMsg) {
        return { success: false, error: "Message not found" };
      }

      const meta = (targetMsg.metadata as Record<string, any>) || {};
      const currentReactions: string[] = Array.isArray(meta.reactions)
        ? meta.reactions
        : [];

      if (!currentReactions.includes(emoji)) {
        currentReactions.push(emoji);
      }

      const updatedMeta = {
        ...meta,
        reactions: currentReactions,
      };

      await db
        .update(messages)
        .set({
          metadata: updatedMeta,
        })
        .where(eq(messages.id, targetMsg.id));

      return {
        success: true,
        emoji,
        messageId: targetMsg.id,
        reactions: currentReactions,
      };
    },
  });
}
