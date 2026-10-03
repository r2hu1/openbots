import { conversations, db, messages } from "@openbots/db";
import { and, asc, desc, eq, lt } from "drizzle-orm";

export async function listConversations(userId: string, agentId?: string) {
  const result = await db
    .select()
    .from(conversations)
    .where(
      agentId
        ? and(
            eq(conversations.userId, userId),
            eq(conversations.agentId, agentId),
          )
        : eq(conversations.userId, userId),
    )
    .orderBy(desc(conversations.updatedAt));
  return { conversations: result };
}

export interface GetConversationOptions {
  limit?: number;
  before?: string; // message ID or timestamp cursor
}

export async function getConversation(
  conversationId: string,
  userId: string,
  options?: GetConversationOptions,
) {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  const before = options?.before;

  let cursorCreatedAt: Date | null = null;
  if (before) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        before,
      );
    if (isUuid) {
      const [beforeMsg] = await db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(
          and(
            eq(messages.id, before),
            eq(messages.conversationId, conversationId),
          ),
        );
      if (beforeMsg) {
        cursorCreatedAt = beforeMsg.createdAt;
      }
    } else {
      const parsedDate = new Date(before);
      if (!Number.isNaN(parsedDate.getTime())) {
        cursorCreatedAt = parsedDate;
      }
    }
  }

  const queryConditions = [eq(messages.conversationId, conversationId)];
  if (cursorCreatedAt) {
    queryConditions.push(lt(messages.createdAt, cursorCreatedAt));
  }

  // Parallelize conversation authorization check and message slice fetch
  const [[conv], rawMessages] = await Promise.all([
    db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.userId, userId),
        ),
      ),
    db
      .select()
      .from(messages)
      .where(and(...queryConditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1),
  ]);

  if (!conv) {
    return null;
  }

  const hasMore = rawMessages.length > limit;
  const slicedMessages = hasMore ? rawMessages.slice(0, limit) : rawMessages;

  // The next cursor for fetching even older messages is the oldest message in this slice
  const nextCursor = hasMore && slicedMessages.length > 0
    ? slicedMessages[slicedMessages.length - 1]?.id
    : null;

  // Reverse so they are in chronological order (oldest to newest) for timeline display
  const chronologicalMessages = [...slicedMessages].reverse();

  return {
    conversation: conv,
    messages: chronologicalMessages,
    pagination: {
      nextCursor,
      hasMore,
      limit,
    },
  };
}
