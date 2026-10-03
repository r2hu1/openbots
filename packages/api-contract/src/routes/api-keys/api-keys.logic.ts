import { db, getRedis, userApiKeys } from "@openbots/db";
import { and, eq } from "drizzle-orm";
import { decryptApiKey, encryptApiKey } from "../../lib/crypto.js";

export const SUPPORTED_PROVIDERS = [
  "openai",
  "anthropic",
  "openrouter",
  "google",
  "groq",
  "xai",
  "deepseek",
] as const;

export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export function isSupportedProvider(
  provider: string,
): provider is SupportedProvider {
  return SUPPORTED_PROVIDERS.includes(provider as SupportedProvider);
}

/**
 * List all configured API keys for a user (without exposing the raw keys).
 */
export async function listUserApiKeys(userId: string) {
  const records = await db
    .select({
      provider: userApiKeys.provider,
      keyHint: userApiKeys.keyHint,
      updatedAt: userApiKeys.updatedAt,
      createdAt: userApiKeys.createdAt,
    })
    .from(userApiKeys)
    .where(eq(userApiKeys.userId, userId));

  return { keys: records };
}

/**
 * Save / Upsert an encrypted API key for a user and provider.
 */
export async function saveUserApiKey(
  userId: string,
  provider: SupportedProvider,
  rawKey: string,
) {
  const trimmed = rawKey.trim();
  if (!trimmed || trimmed.length < 5) {
    throw new Error("Invalid API key format");
  }

  const { encryptedKey, iv, authTag, keyHint } = encryptApiKey(trimmed);

  const [existing] = await db
    .select()
    .from(userApiKeys)
    .where(
      and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider)),
    );

  if (existing) {
    const [updated] = await db
      .update(userApiKeys)
      .set({
        encryptedKey,
        iv,
        authTag,
        keyHint,
        updatedAt: new Date(),
      })
      .where(eq(userApiKeys.id, existing.id))
      .returning({
        provider: userApiKeys.provider,
        keyHint: userApiKeys.keyHint,
        updatedAt: userApiKeys.updatedAt,
      });

    await invalidateApiKeyCache(userId, provider);
    return updated;
  }

  const [inserted] = await db
    .insert(userApiKeys)
    .values({
      userId,
      provider,
      encryptedKey,
      iv,
      authTag,
      keyHint,
    })
    .returning({
      provider: userApiKeys.provider,
      keyHint: userApiKeys.keyHint,
      updatedAt: userApiKeys.updatedAt,
    });

  await invalidateApiKeyCache(userId, provider);
  return inserted;
}

const CACHE_TTL_SECONDS = 300;

export async function invalidateApiKeyCache(userId: string, provider?: string) {
  try {
    const redis = getRedis();
    if (redis) {
      if (provider) {
        await redis.del(`apikey:${userId}:${provider}`);
      }
    }
  } catch {}
}

/**
 * Delete a user's API key for a provider.
 */
export async function deleteUserApiKey(userId: string, provider: string) {
  await invalidateApiKeyCache(userId, provider);
  await db
    .delete(userApiKeys)
    .where(
      and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider)),
    );
  return { success: true };
}

/**
 * Retrieve decrypted user API key for agent execution.
 * Checks Redis first, falls back to DB query + AES decrypt and populates Redis.
 */
export async function getDecryptedUserApiKey(
  userId: string,
  provider: SupportedProvider,
): Promise<string | null> {
  const cacheKey = `apikey:${userId}:${provider}`;

  // 1. Check Redis cache
  try {
    const redis = getRedis();
    if (redis) {
      const cached = await redis.get<string>(cacheKey);
      if (cached !== null) {
        return cached === "__NONE__" ? null : cached;
      }
    }
  } catch {}

  // 2. Database query & decrypt
  const [record] = await db
    .select()
    .from(userApiKeys)
    .where(
      and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider)),
    );

  if (!record) {
    try {
      const redis = getRedis();
      if (redis) redis.setex(cacheKey, CACHE_TTL_SECONDS, "__NONE__").catch(() => {});
    } catch {}
    return null;
  }

  try {
    const decrypted = decryptApiKey(record.encryptedKey, record.iv, record.authTag);
    try {
      const redis = getRedis();
      if (redis) redis.setex(cacheKey, CACHE_TTL_SECONDS, decrypted).catch(() => {});
    } catch {}
    return decrypted;
  } catch (err) {
    console.error(
      `Failed to decrypt API key for user ${userId} and provider ${provider}:`,
      err,
    );
    return null;
  }
}

/**
 * Maps model string prefix (e.g. "openai/gpt-4o", "anthropic/claude-3-5-sonnet") to SupportedProvider.
 */
export function getProviderFromModel(
  modelString: string,
): SupportedProvider | null {
  const prefix = modelString.split("/")[0]?.toLowerCase();
  switch (prefix) {
    case "openai":
      return "openai";
    case "anthropic":
      return "anthropic";
    case "openrouter":
      return "openrouter";
    case "google":
    case "gemini":
      return "google";
    case "groq":
      return "groq";
    case "xai":
    case "grok":
      return "xai";
    case "deepseek":
      return "deepseek";
    default:
      return null;
  }
}

/**
 * Resolves the API key for an agent run by checking user's encrypted keys first,
 * then falling back to environment variables.
 */
export async function getApiKeyForModel(
  userId: string,
  modelString: string,
): Promise<string | null> {
  const provider = getProviderFromModel(modelString);
  if (provider) {
    const userKey = await getDecryptedUserApiKey(userId, provider);
    if (userKey) {
      return userKey;
    }
  }

  // Fallback to process.env variables if user hasn't set custom key
  if (provider === "openai") {
    return process.env.OPENAI_API_KEY || null;
  }
  if (provider === "anthropic") {
    return process.env.ANTHROPIC_API_KEY || null;
  }
  if (provider === "openrouter") {
    return process.env.OPENROUTER_API_KEY || null;
  }
  if (provider === "google") {
    return (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      null
    );
  }
  if (provider === "groq") {
    return process.env.GROQ_API_KEY || null;
  }
  if (provider === "xai") {
    return process.env.XAI_API_KEY || null;
  }
  if (provider === "deepseek") {
    return process.env.DEEPSEEK_API_KEY || null;
  }

  return null;
}
