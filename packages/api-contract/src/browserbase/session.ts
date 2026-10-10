import { getBrowserbaseClient, getBrowserbaseProjectId } from "./client.js";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";

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

// Global active connections map keyed by runId or conversationId or sessionId
// Allows multi-step agent actions within the same run to share the live browser page.
const activeConnections = new Map<string, ActiveBrowserConnection>();

export interface AcquireBrowserOptions {
  key: string;
  timeout?: number;
  blockAds?: boolean;
  solveCaptchas?: boolean;
  recordSession?: boolean;
  logSession?: boolean;
  viewport?: { width: number; height: number };
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

  const session = await bb.sessions.create({
    ...(projectId ? { projectId } : {}),
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
  return conn;
}

/**
 * Releases and disconnects a browser session cleanly.
 */
export async function releaseBrowserSession(key: string): Promise<void> {
  const conn = activeConnections.get(key);
  if (!conn) return;

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
