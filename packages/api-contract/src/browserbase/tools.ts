import { tool } from "ai";
import { z } from "zod";
import {
  acquireBrowserSession,
  releaseBrowserSession,
  setPendingHumanInteraction,
  waitForHumanInteractionResponse,
  type ActiveBrowserConnection,
} from "./session.js";

/**
 * Creates the complete suite of Browserbase browser automation tools
 * for an agent execution context.
 */
export function createBrowserbaseTools(contextKey: string): Record<string, any> {
  // Helper to safely get the current page
  async function getConn(): Promise<ActiveBrowserConnection> {
    return await acquireBrowserSession({
      key: contextKey,
      timeout: 600,
      blockAds: true,
      solveCaptchas: true,
      recordSession: true,
      logSession: true,
    });
  }

  // 1. Navigate to URL
  const browserNavigate = tool({
    description:
      "Navigates the real cloud browser to a URL, waits for the page to load, and returns the title, URL, and status.",
    inputSchema: z.object({
      url: z.string().url().describe("The URL to open in the browser"),
      waitUntil: z
        .enum(["load", "domcontentloaded", "networkidle"])
        .default("domcontentloaded")
        .describe("When to consider navigation succeeded"),
      timeoutMs: z
        .number()
        .default(30000)
        .describe("Max navigation timeout in milliseconds"),
    }),
    execute: async ({ url, waitUntil, timeoutMs }) => {
      try {
        const { page, session } = await getConn();
        const response = await page.goto(url, {
          waitUntil,
          timeout: timeoutMs,
        });

        const title = await page.title();
        const currentUrl = page.url();
        const statusCode = response?.status() ?? 200;

        return {
          success: true,
          status: statusCode,
          title,
          url: currentUrl,
          sessionId: session.sessionId,
          liveViewUrl: session.liveDebuggerFullscreenUrl,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Navigation failed: ${err.message}`,
        };
      }
    },
  });

  // 2. Click Element
  const browserClick = tool({
    description:
      "Clicks an interactive element on the page using a CSS selector or visible text (e.g. 'button:has-text(\"Submit\")' or 'a.nav-link').",
    inputSchema: z.object({
      selector: z
        .string()
        .describe(
          "CSS selector or text selector (e.g. 'button:has-text(\"Search\")', '#submit-btn', 'text=Log In')",
        ),
      timeoutMs: z
        .number()
        .default(10000)
        .describe("Timeout waiting for element in milliseconds"),
    }),
    execute: async ({ selector, timeoutMs }) => {
      try {
        const { page, session } = await getConn();
        await page.waitForSelector(selector, {
          state: "visible",
          timeout: timeoutMs,
        });
        await page.click(selector, { timeout: timeoutMs });
        // Brief settle time
        await page.waitForTimeout(500);

        return {
          success: true,
          message: `Clicked element '${selector}'`,
          currentUrl: page.url(),
          title: await page.title(),
          sessionId: session.sessionId,
          liveViewUrl: session.liveDebuggerFullscreenUrl,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Click failed on '${selector}': ${err.message}`,
        };
      }
    },
  });

  // 3. Type into Input
  const browserType = tool({
    description:
      "Types text into an input or textarea element on the active page.",
    inputSchema: z.object({
      selector: z
        .string()
        .describe("CSS selector of the input field to type into"),
      text: z.string().describe("The text string to type"),
      pressEnter: z
        .boolean()
        .default(false)
        .describe("Whether to press Enter after typing"),
      clearFirst: z
        .boolean()
        .default(true)
        .describe("Whether to clear existing text before typing"),
    }),
    execute: async ({ selector, text, pressEnter, clearFirst }) => {
      try {
        const { page, session } = await getConn();
        await page.waitForSelector(selector, { state: "visible", timeout: 10000 });
        if (clearFirst) {
          await page.fill(selector, "");
        }
        await page.type(selector, text, { delay: 30 });
        if (pressEnter) {
          await page.press(selector, "Enter");
          await page.waitForTimeout(500);
        }

        return {
          success: true,
          message: `Typed into '${selector}'`,
          currentUrl: page.url(),
          title: await page.title(),
          sessionId: session.sessionId,
          liveViewUrl: session.liveDebuggerFullscreenUrl,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Type failed on '${selector}': ${err.message}`,
        };
      }
    },
  });

  // 4. Take Screenshot
  const browserScreenshot = tool({
    description:
      "Captures a visual screenshot of the current browser page (full page or viewport) and returns base64 image data.",
    inputSchema: z.object({
      fullPage: z
        .boolean()
        .default(false)
        .describe("Capture full scrollable page instead of only the viewport"),
    }),
    execute: async ({ fullPage }) => {
      try {
        const { page, session } = await getConn();
        const buffer = await page.screenshot({
          fullPage,
          type: "jpeg",
          quality: 80,
        });
        const base64 = buffer.toString("base64");
        const dataUrl = `data:image/jpeg;base64,${base64}`;

        return {
          success: true,
          url: page.url(),
          title: await page.title(),
          screenshotDataUrl: dataUrl,
          sessionId: session.sessionId,
          liveViewUrl: session.liveDebuggerFullscreenUrl,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Screenshot failed: ${err.message}`,
        };
      }
    },
  });

  // 5. Extract Content / Snapshot Text
  const browserExtractContent = tool({
    description:
      "Extracts readable text, structured elements, and interactive links from the current web page.",
    inputSchema: z.object({
      selector: z
        .string()
        .optional()
        .describe("Optional CSS selector to extract from a specific container (e.g. 'article', 'main', '#content')"),
      maxChars: z
        .number()
        .default(12000)
        .describe("Maximum character length to fit model context"),
    }),
    execute: async ({ selector, maxChars }) => {
      try {
        const { page, session } = await getConn();
        let content: string;
        if (selector) {
          const el = await page.$(selector);
          content = el ? ((await el.innerText()) || "") : "";
        } else {
          content = await page.evaluate(() => {
            const clone = document.body.cloneNode(true) as HTMLElement;
            clone.querySelectorAll("script, style, noscript, svg").forEach((n) => n.remove());
            return clone.innerText || "";
          });
        }

        const trimmed = content.replace(/\s+/g, " ").trim();
        const truncated =
          trimmed.length > maxChars
            ? trimmed.slice(0, maxChars) + "\n...[truncated]"
            : trimmed;

        return {
          success: true,
          url: page.url(),
          title: await page.title(),
          content: truncated,
          sessionId: session.sessionId,
          liveViewUrl: session.liveDebuggerFullscreenUrl,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Extract content failed: ${err.message}`,
        };
      }
    },
  });

  // 6. Scroll Page
  const browserScroll = tool({
    description:
      "Scrolls the current web page up or down to reveal hidden content or lazy-loaded elements.",
    inputSchema: z.object({
      direction: z.enum(["down", "up"]).default("down"),
      pixels: z
        .number()
        .default(800)
        .describe("Amount of pixels to scroll"),
    }),
    execute: async ({ direction, pixels }) => {
      try {
        const { page, session } = await getConn();
        const delta = direction === "down" ? pixels : -pixels;
        await page.evaluate((d) => window.scrollBy({ top: d, behavior: "smooth" }), delta);
        await page.waitForTimeout(500);

        return {
          success: true,
          message: `Scrolled ${direction} by ${pixels}px`,
          url: page.url(),
          title: await page.title(),
          sessionId: session.sessionId,
          liveViewUrl: session.liveDebuggerFullscreenUrl,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Scroll failed: ${err.message}`,
        };
      }
    },
  });

  // 7. Execute JavaScript in Page
  const browserEvaluate = tool({
    description:
      "Runs custom JavaScript in the browser console of the active page and returns the serialized result.",
    inputSchema: z.object({
      script: z
        .string()
        .describe(
          "JavaScript expression or function body to evaluate (e.g. 'document.title' or 'Array.from(document.querySelectorAll(\"h2\")).map(h => h.innerText)')",
        ),
    }),
    execute: async ({ script }) => {
      try {
        const { page, session } = await getConn();
        const result = await page.evaluate((code) => {
          return window.eval(code);
        }, script);

        return {
          success: true,
          result,
          url: page.url(),
          title: await page.title(),
          sessionId: session.sessionId,
          liveViewUrl: session.liveDebuggerFullscreenUrl,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Evaluate failed: ${err.message}`,
        };
      }
    },
  });

  // 8. Wait for User Interaction / Human-in-the-Loop
  const browserWaitForUser = tool({
    description:
      "Pauses execution and waits for the user to complete a manual action directly in the live browser preview (such as logging in, solving a CAPTCHA, approving 2FA, or clicking an authorization button). Returns immediately when the user clicks 'I'm Done' in the UI or when the selector appears.",
    inputSchema: z.object({
      instruction: z
        .string()
        .describe(
          "Clear explanation instructing the user what action to take in the live browser window (e.g. 'Please sign in with your credentials in the browser on the right', 'Please solve the CAPTCHA')",
        ),
      waitForSelector: z
        .string()
        .optional()
        .describe(
          "Optional CSS selector to wait for that signals the user has finished (e.g. '.dashboard', 'text=Welcome', '#user-profile')",
        ),
      timeoutSeconds: z
        .number()
        .default(120)
        .describe("Maximum seconds to wait for user interaction before proceeding (up to 300s)"),
    }),
    execute: async ({ instruction, waitForSelector, timeoutSeconds }) => {
      try {
        const { page, session } = await getConn();
        const timeoutMs = Math.min(Math.max(timeoutSeconds, 10), 300) * 1000;
        const currentUrl = page.url();
        const pageTitle = await page.title();

        const requestId = `hitl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await setPendingHumanInteraction(contextKey, {
          id: requestId,
          contextKey,
          instruction,
          url: currentUrl,
          title: pageTitle,
          liveViewUrl: session.liveDebuggerFullscreenUrl,
          createdAt: Date.now(),
          timeoutSeconds,
        });

        // Race between user clicking "Done/Continue" in the UI (via Redis) AND selector appearing on the page
        const hitlPromise = waitForHumanInteractionResponse(contextKey, timeoutMs);

        let selectorPromise: Promise<{ found: boolean }> = new Promise(() => {});
        if (waitForSelector) {
          selectorPromise = page
            .waitForSelector(waitForSelector, {
              state: "visible",
              timeout: timeoutMs,
            })
            .then(() => ({ found: true }))
            .catch(() => ({ found: false }));
        }

        const raceWinner = await Promise.race([
          hitlPromise.then((res) => ({ type: "hitl" as const, res })),
          selectorPromise.then((res) => ({ type: "selector" as const, res })),
        ]);

        const finalUrl = page.url();
        const finalTitle = await page.title();

        let resolutionNote = "";
        if (raceWinner.type === "hitl" && raceWinner.res) {
          resolutionNote =
            raceWinner.res.action === "skipped"
              ? "User skipped interaction."
              : `User confirmed completion in UI${raceWinner.res.notes ? `: ${raceWinner.res.notes}` : "."}`;
        } else if (raceWinner.type === "selector" && raceWinner.res.found) {
          resolutionNote = `Detected completion signal element "${waitForSelector}".`;
        } else {
          resolutionNote = "Wait timeout elapsed; continuing with current page state.";
        }

        return {
          success: true,
          message: `User interaction step completed: "${instruction}". ${resolutionNote}`,
          url: finalUrl,
          title: finalTitle,
          sessionId: session.sessionId,
          liveViewUrl: session.liveDebuggerFullscreenUrl,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Wait for user interaction failed: ${err.message}`,
        };
      }
    },
  });

  // 9. Close Browser Session
  const browserClose = tool({
    description:
      "Explicitly releases and terminates the cloud browser session. ONLY call this if the user specifically instructs you to close/terminate the browser session. Do NOT call this at the end of regular tasks, so the user can continue viewing or interacting with the page.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        await releaseBrowserSession(contextKey);
        return {
          success: true,
          message: "Browser session released cleanly",
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Failed to close browser: ${err.message}`,
        };
      }
    },
  });

  return {
    browser_navigate: browserNavigate,
    browser_click: browserClick,
    browser_type: browserType,
    browser_screenshot: browserScreenshot,
    browser_extract_content: browserExtractContent,
    browser_scroll: browserScroll,
    browser_evaluate: browserEvaluate,
    browser_wait_for_user: browserWaitForUser,
    browser_close: browserClose,
  };
}
