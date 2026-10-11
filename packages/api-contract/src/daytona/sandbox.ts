import type { Sandbox } from "@daytona/sdk";
import { getDaytonaClient } from "./client.js";
import { getRedis } from "@openbots/db";

export interface DaytonaDesktopSessionInfo {
  sandboxId: string;
  vncUrl?: string;
  liveDebuggerFullscreenUrl?: string; // Kept for backwards compatibility with UI components
  liveViewUrl?: string;
}

/**
 * Creates a new Daytona sandbox for an agent.
 * Pre-configures desktop/VNC resolution.
 * Stores sandbox reference in Redis.
 */
export async function createAgentSandbox(agentName: string): Promise<string | null> {
  const daytona = getDaytonaClient();
  if (!daytona) {
    console.warn("DAYTONA_API_KEY not configured, skipping sandbox creation");
    return null;
  }

  try {
    const sanitizedName = `agent-${agentName.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 20)}-${Date.now().toString(36)}`;
    const sandbox = await daytona.create({
      name: sanitizedName,
      envVars: {
        VNC_RESOLUTION: "1280x800",
      },
    });

    const redis = getRedis();
    if (redis) {
      await redis.set(`daytona:sandbox:${sandbox.id}`, JSON.stringify({
        id: sandbox.id,
        name: sandbox.name,
        createdAt: Date.now(),
      }), { ex: 86400 * 7 }).catch(() => {});
    }

    return sandbox.id;
  } catch (err) {
    console.error("Failed to create Daytona sandbox for agent:", err);
    return null;
  }
}

/**
 * Deletes a Daytona sandbox when an agent is deleted.
 * Cleans up Redis cache and Daytona cloud resource.
 */
export async function deleteAgentSandbox(sandboxId: string): Promise<void> {
  const daytona = getDaytonaClient();
  if (!daytona || !sandboxId) return;

  const redis = getRedis();
  if (redis) {
    await redis.del(`daytona:sandbox:${sandboxId}`).catch(() => {});
  }

  try {
    const sandbox = await daytona.get(sandboxId);
    if (sandbox) {
      await daytona.delete(sandbox);
    }
  } catch (err) {
    console.warn(`Failed to delete Daytona sandbox ${sandboxId}:`, err);
  }
}

/**
 * Retrieves a running sandbox instance by ID directly via the Daytona client.
 * Uses Redis for session metadata rather than in-process state.
 */
export async function getAgentSandbox(sandboxId: string): Promise<Sandbox | null> {
  if (!sandboxId) return null;

  const daytona = getDaytonaClient();
  if (!daytona) return null;

  try {
    const sandbox = await daytona.get(sandboxId);
    return sandbox ?? null;
  } catch (err) {
    console.error(`Failed to retrieve Daytona sandbox ${sandboxId}:`, err);
    return null;
  }
}

/**
 * Starts Computer Use and returns a signed VNC preview URL for the desktop.
 * Caches the signed URL in Redis to avoid re-generating on every call.
 * Port 6080 is the default noVNC port.
 */
export async function ensureDesktopLiveView(sandbox: Sandbox): Promise<string | null> {
  const redis = getRedis();
  const cacheKey = `daytona:preview:${sandbox.id}`;

  if (redis) {
    try {
      const cachedUrl = await redis.get<string>(cacheKey);
      if (cachedUrl) {
        return cachedUrl;
      }
    } catch {}
  }

  try {
    // Start computer use processes if not already running
    await sandbox.computerUse.start().catch(() => {});
    
    // Generate signed preview URL for noVNC (port 6080) valid for 1 hour
    const preview = await sandbox.getSignedPreviewUrl(6080, 3600);
    const url = preview.url;

    if (redis && url) {
      // Cache with 50 minute TTL (safely under 1 hour validity)
      await redis.set(cacheKey, url, { ex: 3000 }).catch(() => {});
    }

    return url;
  } catch (err) {
    console.warn("Failed to get signed preview URL for sandbox desktop:", err);
    return null;
  }
}

/**
 * Get active desktop session info for a given contextKey or sandboxId from Redis.
 */
export async function getActiveDesktopSessionInfo(
  contextKey: string,
): Promise<DaytonaDesktopSessionInfo | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const data = await redis.get<string>(`desktop:session:${contextKey}`);
      if (data) {
        return typeof data === "string" ? JSON.parse(data) : (data as DaytonaDesktopSessionInfo);
      }
    } catch {}
  }
  return null;
}

/**
 * Store active desktop session info in Redis.
 */
export async function setActiveDesktopSessionInfo(
  contextKey: string,
  info: DaytonaDesktopSessionInfo,
): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(`desktop:session:${contextKey}`, JSON.stringify(info), { ex: 3600 }).catch(() => {});
  }
}

/**
 * Clears active desktop session info from Redis when execution finishes or session closes.
 */
export async function clearActiveDesktopSessionInfo(
  contextKey: string,
): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(`desktop:session:${contextKey}`).catch(() => {});
  }
}
