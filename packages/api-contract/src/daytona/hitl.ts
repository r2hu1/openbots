import { getRedis } from "@openbots/db";

export interface HumanInteractionRequest {
  id: string;
  runId?: string;
  contextKey: string;
  instruction: string;
  url?: string;
  title?: string;
  liveViewUrl?: string;
  createdAt: number;
  timeoutSeconds: number;
}

export interface HumanInteractionResponse {
  action: "completed" | "skipped";
  notes?: string;
  respondedAt?: number;
}

/**
 * Persist pending human interaction in Redis.
 */
export async function setPendingHumanInteraction(
  contextKey: string,
  request: HumanInteractionRequest,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const key = `hitl:pending:${contextKey}`;
  const runKey = request.runId ? `hitl:pending:run:${request.runId}` : null;
  const ttl = Math.max(request.timeoutSeconds + 60, 300);

  const payload = JSON.stringify(request);
  const pipeline = redis.pipeline();
  pipeline.set(key, payload, { ex: ttl });
  if (runKey) {
    pipeline.set(runKey, contextKey, { ex: ttl });
  }
  await pipeline.exec();
}

/**
 * Get pending human interaction from Redis.
 */
export async function getPendingHumanInteraction(
  contextKey: string,
): Promise<HumanInteractionRequest | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const data = await redis.get<string>(`hitl:pending:${contextKey}`);
    if (!data) return null;
    return typeof data === "string" ? JSON.parse(data) : (data as HumanInteractionRequest);
  } catch {
    return null;
  }
}

/**
 * Record user's human interaction response in Redis.
 */
export async function submitHumanInteractionResponse(
  contextKey: string,
  response: HumanInteractionResponse,
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  const responseKey = `hitl:response:${contextKey}`;
  const pendingKey = `hitl:pending:${contextKey}`;

  const payload = JSON.stringify({
    ...response,
    respondedAt: Date.now(),
  });

  const pipeline = redis.pipeline();
  pipeline.set(responseKey, payload, { ex: 300 });
  pipeline.del(pendingKey);
  await pipeline.exec();

  return true;
}

/**
 * Poll Redis for user's response or until timeout.
 */
export async function waitForHumanInteractionResponse(
  contextKey: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<HumanInteractionResponse | null> {
  const redis = getRedis();
  const startTime = Date.now();
  const pollInterval = 600;

  while (Date.now() - startTime < timeoutMs) {
    if (signal?.aborted) {
      return { action: "skipped", notes: "Execution aborted" };
    }

    if (redis) {
      try {
        const responseData = await redis.get<string>(`hitl:response:${contextKey}`);
        if (responseData) {
          const parsed =
            typeof responseData === "string"
              ? JSON.parse(responseData)
              : (responseData as HumanInteractionResponse);
          await redis.del(`hitl:response:${contextKey}`).catch(() => {});
          return parsed;
        }
      } catch (err) {
        console.warn("Error checking Redis HITL response:", err);
      }
    }

    await new Promise((r) => setTimeout(r, pollInterval));
  }

  if (redis) {
    await redis.del(`hitl:pending:${contextKey}`).catch(() => {});
  }

  return null;
}
