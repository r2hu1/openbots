import { getBrowserbaseClient, getBrowserbaseProjectId } from "./client.js";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";

import { getRedis } from "@openbots/db";

export interface BrowserbaseSessionInfo {
  sessionId: string;
  connectUrl: string;
  liveDebuggerUrl?: string;
  liveDebuggerFullscreenUrl?: string;
}

export interface ActiveBrowserConnection {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  session: BrowserbaseSessionInfo;
  lastUsedAt: number;
}

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
          // Clean up response key
          await redis.del(`hitl:response:${contextKey}`).catch(() => {});
          return parsed;
        }
      } catch (err) {
        console.warn("Error checking Redis HITL response:", err);
      }
    }

    await new Promise((r) => setTimeout(r, pollInterval));
  }

  // Timeout reached: clean up pending key
  if (redis) {
    await redis.del(`hitl:pending:${contextKey}`).catch(() => {});
  }

  return null;
}

// In-process CDP connection pool (Playwright Browser instances cannot be stored in Redis because CDP websockets are in-memory node objects)
const activeConnections = new Map<string, ActiveBrowserConnection>();

export interface AcquireBrowserOptions {
  key: string;
  timeout?: number;
  blockAds?: boolean;
  solveCaptchas?: boolean;
  recordSession?: boolean;
  logSession?: boolean;
  viewport?: { width: number; height: number };
  region?: "us-west-2" | "us-east-1" | "eu-central-1" | "ap-southeast-1";
}

/**
 * Acquire or reuse an existing Browserbase browser session.
 * Reuses active page across multiple browser tool calls in the same agent execution.
 */
export async function acquireBrowserSession(
  options: AcquireBrowserOptions,
): Promise<ActiveBrowserConnection> {
  const { key } = options;

  const existing = activeConnections.get(key);
  if (existing && !existing.browser.isConnected()) {
    activeConnections.delete(key);
  } else if (existing) {
    try {
      if (!existing.page.isClosed()) {
        existing.lastUsedAt = Date.now();
        return existing;
      }
      // If previous page was closed, grab the default or new page
      const pages = existing.context.pages();
      existing.page = pages[0] || (await existing.context.newPage());
      existing.lastUsedAt = Date.now();
      return existing;
    } catch {
      activeConnections.delete(key);
    }
  }

  const bb = getBrowserbaseClient();
  if (!bb) {
    throw new Error(
      "BROWSERBASE_API_KEY environment variable is not configured",
    );
  }

  const projectId = getBrowserbaseProjectId();
  const configuredRegion =
    options.region ||
    (process.env.BROWSERBASE_REGION as any) ||
    undefined;

  const session = await bb.sessions.create({
    ...(projectId ? { projectId } : {}),
    ...(configuredRegion ? { region: configuredRegion } : {}),
    keepAlive: true,
    browserSettings: {
      viewport: options.viewport ?? { width: 1280, height: 800 },
      blockAds: options.blockAds ?? true,
      solveCaptchas: options.solveCaptchas ?? true,
      recordSession: options.recordSession ?? true,
      logSession: options.logSession ?? true,
    },
  });

  const browser = await chromium.connectOverCDP(session.connectUrl);
  // Browserbase pre-creates the default context and page
  const context = browser.contexts()[0] || (await browser.newContext());
  const page = context.pages()[0] || (await context.newPage());

  let liveDebuggerUrl: string | undefined;
  let liveDebuggerFullscreenUrl: string | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const debug = await bb.sessions.debug(session.id);
      if (debug.debuggerFullscreenUrl) {
        liveDebuggerUrl = debug.debuggerUrl;
        liveDebuggerFullscreenUrl = debug.debuggerFullscreenUrl;
        break;
      }
    } catch {
      // Small pause before retry
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  if (!liveDebuggerFullscreenUrl) {
    liveDebuggerFullscreenUrl = `https://www.browserbase.com/sessions/${session.id}`;
  }

  const conn: ActiveBrowserConnection = {
    browser,
    context,
    page,
    session: {
      sessionId: session.id,
      connectUrl: session.connectUrl,
      liveDebuggerUrl,
      liveDebuggerFullscreenUrl,
    },
    lastUsedAt: Date.now(),
  };

  activeConnections.set(key, conn);

  // Store active session metadata in Redis with 1 hour TTL so UI & cross-turn execution persist
  const redis = getRedis();
  if (redis) {
    await redis.set(
      `browser:session:${key}`,
      JSON.stringify(conn.session),
      { ex: 3600 }
    ).catch(() => {});
  }

  return conn;
}

/**
 * Get active browser session info for a given contextKey (from in-process map or Redis).
 */
export async function getActiveBrowserSessionInfo(
  key: string
): Promise<BrowserbaseSessionInfo | null> {
  const inMemory = activeConnections.get(key);
  if (inMemory && inMemory.browser.isConnected()) {
    return inMemory.session;
  }

  const redis = getRedis();
  if (redis) {
    try {
      const data = await redis.get<string>(`browser:session:${key}`);
      if (data) {
        return typeof data === "string" ? JSON.parse(data) : (data as BrowserbaseSessionInfo);
      }
    } catch {}
  }

  return null;
}

/**
 * Releases and disconnects a browser session cleanly.
 */
export async function releaseBrowserSession(key: string): Promise<void> {
  const conn = activeConnections.get(key);
  if (conn) {
    activeConnections.delete(key);
    try {
      if (conn.browser.isConnected()) {
        await conn.browser.close().catch(() => {});
      }
    } catch {}

    const bb = getBrowserbaseClient();
    if (bb && conn.session.sessionId) {
      const projectId = getBrowserbaseProjectId();
      await bb.sessions
        .update(conn.session.sessionId, {
          ...(projectId ? { projectId } : {}),
          status: "REQUEST_RELEASE",
        })
        .catch(() => {});
    }
  }

  const redis = getRedis();
  if (redis) {
    await redis.del(`browser:session:${key}`).catch(() => {});
  }
}
