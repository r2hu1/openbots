import { db, getRedis, type Memory, memories } from "@openbots/db";
import { and, desc, eq, ilike, isNull, or, type SQL } from "drizzle-orm";

const MEMORY_CACHE_PREFIX = "memory:user:";
const MEMORY_TTL = 3600; // 1 hour

function getUserMemoriesCacheKey(userId: string): string {
  return `${MEMORY_CACHE_PREFIX}${userId}:all`;
}

async function invalidateUserMemoryCache(userId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(getUserMemoriesCacheKey(userId)).catch(() => {});
  }
}

export interface SearchMemoriesParams {
  userId: string;
  agentId?: string | null;
  query?: string;
  category?: string;
  limit?: number;
}

export async function searchMemories(
  params: SearchMemoriesParams,
): Promise<Memory[]> {
  const { userId, agentId, query, category, limit = 20 } = params;
  const redis = getRedis();

  // If simple listing without filter, try redis cache first
  if (!query && !category && !agentId && redis) {
    try {
      const cached = await redis.get<Memory[]>(getUserMemoriesCacheKey(userId));
      if (cached && Array.isArray(cached)) {
        return cached.slice(0, limit);
      }
    } catch {
      // cache miss fallback
    }
  }

  const conditions: SQL[] = [eq(memories.userId, userId)];

  if (agentId) {
    const agentMatch = or(
      eq(memories.agentId, agentId),
      isNull(memories.agentId),
    );
    if (agentMatch) {
      conditions.push(agentMatch);
    }
  }

  if (category) {
    conditions.push(eq(memories.category, category));
  }

  if (query?.trim()) {
    const pattern = `%${query.trim()}%`;
    const searchMatch = or(
      ilike(memories.key, pattern),
      ilike(memories.content, pattern),
      ilike(memories.category, pattern),
    );
    if (searchMatch) {
      conditions.push(searchMatch);
    }
  }

  const results = await db
    .select()
    .from(memories)
    .where(and(...conditions))
    .orderBy(desc(memories.updatedAt))
    .limit(limit);

  // Cache if all memories for user
  if (!query && !category && !agentId && redis) {
    await redis
      .set(getUserMemoriesCacheKey(userId), JSON.stringify(results), {
        ex: MEMORY_TTL,
      })
      .catch(() => {});
  }

  return results;
}

export interface SetMemoryParams {
  userId: string;
  agentId?: string | null;
  key: string;
  content: string;
  category?: string;
  metadata?: Record<string, unknown>;
}

export async function setMemory(params: SetMemoryParams): Promise<Memory> {
  const {
    userId,
    agentId,
    key,
    content,
    category = "general",
    metadata,
  } = params;

  // Check if existing memory with same key for this user
  const [existing] = await db
    .select()
    .from(memories)
    .where(and(eq(memories.userId, userId), eq(memories.key, key)));

  let result: Memory;
  if (existing) {
    const [updated] = await db
      .update(memories)
      .set({
        content,
        category,
        agentId: agentId || existing.agentId,
        metadata: metadata ?? (existing.metadata as Record<string, unknown>),
        updatedAt: new Date(),
      })
      .where(eq(memories.id, existing.id))
      .returning();
    if (!updated) {
      throw new Error("Failed to update memory");
    }
    result = updated;
  } else {
    const [created] = await db
      .insert(memories)
      .values({
        userId,
        agentId: agentId ?? null,
        key,
        content,
        category,
        metadata: metadata ?? null,
      })
      .returning();
    if (!created) {
      throw new Error("Failed to create memory");
    }
    result = created;
  }

  await invalidateUserMemoryCache(userId);
  return result;
}

export async function deleteMemory(
  userId: string,
  keyOrId: string,
): Promise<boolean> {
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      keyOrId,
    );
  const deleteFilter = isUuid
    ? or(eq(memories.key, keyOrId), eq(memories.id, keyOrId))
    : eq(memories.key, keyOrId);

  const deleted = await db
    .delete(memories)
    .where(and(eq(memories.userId, userId), deleteFilter))
    .returning();

  await invalidateUserMemoryCache(userId);
  return deleted.length > 0;
}
