import { conversations, db, messages } from "@openbots/db";
import { and, asc, desc, eq, lt, sql } from "drizzle-orm";

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
  const nextCursor =
    hasMore && slicedMessages.length > 0
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

export async function searchTimelineMessages(
  userId: string,
  query: string,
  limit: number = 20,
) {
  const sanitized = query.trim();
  if (!sanitized) return { results: [] };

  // Search user/assistant text in messages and include conversation & agent information
  const found = await db
    .select({
      messageId: messages.id,
      conversationId: messages.conversationId,
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
      agentId: conversations.agentId,
      conversationTitle: conversations.title,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.userId, userId),
        sql`(${messages.content}->>'text' ILIKE ${`%${sanitized}%`} OR ${messages.content}->>'prompt' ILIKE ${`%${sanitized}%`})`,
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(Math.min(Math.max(limit, 1), 30));

  return {
    results: found.map((row) => {
      const rawContent = row.content as any;
      const text =
        typeof rawContent === "string"
          ? rawContent
          : rawContent?.text || rawContent?.prompt || "";
      return {
        messageId: row.messageId,
        conversationId: row.conversationId,
        role: row.role,
        text: typeof text === "string" ? text.slice(0, 200) : "",
        createdAt: row.createdAt,
        agentId: row.agentId,
        conversationTitle: row.conversationTitle,
      };
    }),
  };
}

export async function toggleMessageReaction(
  userId: string,
  messageId: string,
  emoji: string,
) {
  // Ensure the user owns the conversation this message belongs to
  const [msg] = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      role: messages.role,
      metadata: messages.metadata,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(eq(messages.id, messageId), eq(conversations.userId, userId)));

  if (!msg) {
    return { error: "Message not found", status: 404 as const };
  }

  // Users cannot react to their own messages, only to agent/assistant messages
  if (msg.role === "user") {
    return {
      error: "You can only react to agent messages",
      status: 400 as const,
    };
  }

  const meta = (msg.metadata as Record<string, any>) || {};
  const currentReactions: string[] = Array.isArray(meta.reactions)
    ? [...meta.reactions]
    : [];

  const index = currentReactions.indexOf(emoji);
  if (index > -1) {
    currentReactions.splice(index, 1);
  } else {
    currentReactions.push(emoji);
  }

  const updatedMetadata = {
    ...meta,
    reactions: currentReactions,
  };

  await db
    .update(messages)
    .set({
      metadata: updatedMetadata,
    })
    .where(eq(messages.id, msg.id));

  return {
    success: true,
    messageId: msg.id,
    reactions: currentReactions,
    status: 200 as const,
  };
}

export async function uploadConversationImage(
  userId: string,
  file: File | Blob,
  fileName?: string,
) {
  // Validate file size: 5MB maximum
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    return {
      error: "File size exceeds the 5MB maximum limit.",
      status: 400 as const,
    };
  }

  // Validate mime type: images only
  const contentType = file.type || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return {
      error: "Only image files (JPEG, PNG, WebP, GIF, SVG) are allowed.",
      status: 400 as const,
    };
  }

  const extension =
    fileName?.split(".").pop() || contentType.split("/")[1] || "png";
  const uniqueId = crypto.randomUUID();
  const bucket =
    process.env.SUPABASE_STORAGE_BUCKET || "conversation-attachments";
  const path = `${userId}/${uniqueId}.${extension}`;

  const { uploadStorageObject, getStoragePublicUrl } = await import(
    "@openbots/db"
  );
  const arrayBuffer = await file.arrayBuffer();

  const { data, error } = await uploadStorageObject({
    bucket,
    path,
    fileBody: arrayBuffer,
    contentType,
    upsert: false,
  });

  if (error || !data) {
    console.error("Failed to upload image to Supabase storage:", error);
    return {
      error: error?.message || "Failed to upload image to storage.",
      status: 500 as const,
    };
  }

  const { data: publicUrlData } = getStoragePublicUrl(bucket, path);

  return {
    success: true,
    url: publicUrlData.publicUrl,
    path,
    status: 200 as const,
  };
}

export async function deleteConversationImage(
  userId: string,
  filePathOrUrl: string,
) {
  const bucket =
    process.env.SUPABASE_STORAGE_BUCKET || "conversation-attachments";
  let targetPath = filePathOrUrl;

  // If a full public URL was provided, extract the path after bucket name
  if (
    filePathOrUrl.startsWith("http://") ||
    filePathOrUrl.startsWith("https://")
  ) {
    const urlParts = filePathOrUrl.split(`/${bucket}/`);
    if (urlParts.length > 1) {
      targetPath = decodeURIComponent(urlParts[1]!.split("?")[0]!);
    }
  }

  // Security check: ensure user owns this file path
  if (!targetPath.startsWith(`${userId}/`)) {
    return {
      error: "Unauthorized to delete this file",
      status: 403 as const,
    };
  }

  const { deleteStorageObject } = await import("@openbots/db");
  const { error } = await deleteStorageObject(bucket, targetPath);

  if (error) {
    console.warn("Failed to delete object from storage:", error);
    return {
      error: error.message || "Failed to delete file from storage.",
      status: 500 as const,
    };
  }

  return {
    success: true,
    path: targetPath,
    status: 200 as const,
  };
}
