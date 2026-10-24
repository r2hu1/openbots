import { db, getRedis, type Memory, memories } from "@openbots/db";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";

const MEMORY_CACHE_PREFIX = "memory:agent:";
const MEMORY_TTL = 3600; // 1 hour

function getAgentMemoriesCacheKey(agentId: string): string {
  return `${MEMORY_CACHE_PREFIX}${agentId}:all`;
}

async function invalidateAgentMemoryCache(agentId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(getAgentMemoriesCacheKey(agentId)).catch(() => {});
  }
}

export interface SearchMemoriesParams {
  userId: string;
  agentId: string;
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
  if (!query && !category && redis) {
    try {
      const cached = await redis.get<Memory[]>(
        getAgentMemoriesCacheKey(agentId),
      );
      if (cached && Array.isArray(cached)) {
        return cached.slice(0, limit);
      }
    } catch {
      // cache miss fallback
    }
  }

  const conditions: SQL[] = [
    eq(memories.userId, userId),
    eq(memories.agentId, agentId),
  ];

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

  // Cache if all memories for agent
  if (!query && !category && redis) {
    await redis
      .set(getAgentMemoriesCacheKey(agentId), JSON.stringify(results), {
        ex: MEMORY_TTL,
      })
      .catch(() => {});
  }

  return results;
}

export interface SetMemoryParams {
  userId: string;
  agentId: string;
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

  // Check if existing memory with same key for this agent
  const [existing] = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.userId, userId),
        eq(memories.agentId, agentId),
        eq(memories.key, key),
      ),
    );

  let result: Memory;
  if (existing) {
    const [updated] = await db
      .update(memories)
      .set({
        content,
        category,
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
        agentId,
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

  await invalidateAgentMemoryCache(agentId);
  return result;
}

export async function deleteMemory(
  userId: string,
  agentId: string,
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
    .where(
      and(
        eq(memories.userId, userId),
        eq(memories.agentId, agentId),
        deleteFilter,
      ),
    )
    .returning();

  await invalidateAgentMemoryCache(agentId);
  return deleted.length > 0;
}
