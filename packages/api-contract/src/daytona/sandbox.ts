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
      // Disable auto-stop and auto-pause so sandboxes don't stop after 15 minutes of inactivity
      autoStopInterval: 0,
      autoPauseInterval: 0,
      autoArchiveInterval: 0,
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
 * Automatically wakes up/starts the sandbox if it is paused or stopped.
 * Uses Redis for session metadata rather than in-process state.
 */
export async function getAgentSandbox(sandboxId: string): Promise<Sandbox | null> {
  if (!sandboxId) return null;

  const daytona = getDaytonaClient();
  if (!daytona) return null;

  try {
    const sandbox = await daytona.get(sandboxId);
    if (!sandbox) return null;

    // Check if sandbox is paused or stopped and resume/start it
    const state = (sandbox.state as string || "").toLowerCase();
    if (state === "paused" || state === "stopped" || state === "archived") {
      console.log(`Sandbox ${sandboxId} is in '${state}' state. Resuming/starting...`);
      await sandbox.start().catch((startErr) => {
        console.warn(`Failed to start/resume sandbox ${sandboxId}:`, startErr);
      });
    }

    // Refresh activity to reset idle timer
    await sandbox.refreshActivity().catch(() => {});

    return sandbox;
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
    // Check if sandbox is in stopped or paused state and start it
    const state = (sandbox.state as string || "").toLowerCase();
    if (state === "paused" || state === "stopped" || state === "archived") {
      await sandbox.start().catch(() => {});
    }

    // Refresh activity and ensure autostop is disabled
    await sandbox.refreshActivity().catch(() => {});
    await sandbox.setAutostopInterval(0).catch(() => {});
    await sandbox.setAutoPauseInterval(0).catch(() => {});

    // Start computer use processes if not already running
    await sandbox.computerUse.start().catch(() => {});

    // Ensure websockify / noVNC on port 6080 is actually accepting connections before returning signed URL
    // Give desktop services up to 2.5s warm-up if starting fresh
    await new Promise((r) => setTimeout(r, 1200));

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
