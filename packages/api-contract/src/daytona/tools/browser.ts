import { tool } from "ai";
import { z } from "zod";
import {
  setPendingHumanInteraction,
  waitForHumanInteractionResponse,
} from "../hitl.js";
import { clearActiveDesktopSessionInfo } from "../sandbox.js";
import type { DaytonaSandboxContext } from "./context.js";

export function createDaytonaBrowserTools(ctx: DaytonaSandboxContext): Record<string, any> {
  const { getSandbox, getLiveView, options } = ctx;
  const { contextKey } = options;

  const browserNavigate = tool({
    description:
      "Navigates the live desktop browser in the Daytona sandbox to any web URL. ALWAYS use this tool whenever the user asks to go to, open, visit, browse, or view any website or URL (e.g. google.com, github.com, any domain) or before taking a screenshot of a webpage.",
    inputSchema: z.object({
      url: z.string().url().describe("The web URL to open"),
    }),
    execute: async ({ url }) => {
      try {
        const sandbox = await getSandbox();
        await sandbox.computerUse.start().catch(() => {});

        // Eagerly ensure desktop live view & active session info so preview sidebar is immediately active
        const liveViewUrl = await getLiveView(sandbox);

        // Launch browser with DISPLAY=:0 in the background
        const launchCmd = `DISPLAY=:0 sh -c '
if command -v google-chrome >/dev/null 2>&1; then
  google-chrome --no-sandbox --disable-dev-shm-usage --disable-gpu --start-maximized "${url}" >/dev/null 2>&1 &
elif command -v chromium-browser >/dev/null 2>&1; then
  chromium-browser --no-sandbox --disable-dev-shm-usage --disable-gpu --start-maximized "${url}" >/dev/null 2>&1 &
elif command -v chromium >/dev/null 2>&1; then
  chromium --no-sandbox --disable-dev-shm-usage --disable-gpu --start-maximized "${url}" >/dev/null 2>&1 &
elif command -v firefox >/dev/null 2>&1; then
  firefox "${url}" >/dev/null 2>&1 &
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "${url}" >/dev/null 2>&1 &
fi
'`;
        await sandbox.process.executeCommand(launchCmd).catch(() => {});

        // Allow browser window a brief moment to render content on screen
        await new Promise((r) => setTimeout(r, 800));
        const windows = await sandbox.computerUse.display
          .getWindows()
          .catch(() => ({ windows: [] }));
        const activeTitle = windows.windows?.[0]?.title || url;

        return {
          success: true,
          status: 200,
          title: activeTitle,
          url,
          liveViewUrl,
          sandboxId: sandbox.id,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Navigation failed: ${err.message}`,
        };
      }
    },
  });

  const browserExtractContent = tool({
    description:
      "Extracts visible windows and accessibility tree elements from the current desktop.",
    inputSchema: z.object({
      maxChars: z
        .number()
        .default(12000)
        .describe("Maximum character length"),
    }),
    execute: async ({ maxChars }) => {
      try {
        const sandbox = await getSandbox();
        await sandbox.computerUse.start().catch(() => {});

        const [windows, tree] = await Promise.all([
          sandbox.computerUse.display
            .getWindows()
            .catch(() => ({ windows: [] })),
          sandbox.computerUse.accessibility
            .getTree({ scope: "all", maxDepth: 3 })
            .catch(() => null),
        ]);

        let summary = `Open Windows:\n${JSON.stringify(windows, null, 2)}\n\nAccessibility Tree:\n${JSON.stringify(tree, null, 2)}`;
        if (summary.length > maxChars) {
          summary = summary.slice(0, maxChars) + "\n...[truncated]";
        }

        return {
          success: true,
          content: summary,
          sandboxId: sandbox.id,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Extract content failed: ${err.message}`,
        };
      }
    },
  });

  const browserWaitForUser = tool({
    description:
      "Pauses execution and opens the live desktop preview for the user to complete a manual action (such as logging in, solving a CAPTCHA, or approving 2FA). Returns when the user clicks 'I'm Done'.",
    inputSchema: z.object({
      instruction: z
        .string()
        .describe(
          "Clear instructions explaining what action the user must take on the screen",
        ),
      timeoutSeconds: z
        .number()
        .default(120)
        .describe("Maximum seconds to wait (up to 300s)"),
    }),
    execute: async ({ instruction, timeoutSeconds }) => {
      try {
        const sandbox = await getSandbox();
        // Ensure live view is active and opens sidebar for user
        const liveViewUrl = await getLiveView(sandbox);
        const timeoutMs =
          Math.min(Math.max(timeoutSeconds, 10), 300) * 1000;

        const requestId = `hitl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await setPendingHumanInteraction(contextKey, {
          id: requestId,
          contextKey,
          instruction,
          liveViewUrl,
          createdAt: Date.now(),
          timeoutSeconds,
        });

        const hitlRes = await waitForHumanInteractionResponse(
          contextKey,
          timeoutMs,
        );

        const resolutionNote =
          hitlRes?.action === "skipped"
            ? "User skipped interaction."
            : hitlRes
              ? `User confirmed completion in UI${hitlRes.notes ? `: ${hitlRes.notes}` : "."}`
              : "Wait timeout elapsed; continuing.";

        return {
          success: true,
          message: `User interaction step completed: "${instruction}". ${resolutionNote}`,
          sandboxId: sandbox.id,
          liveViewUrl,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Wait for user interaction failed: ${err.message}`,
        };
      }
    },
  });

  const browserClose = tool({
    description:
      "Stops desktop computer use processes in the sandbox and ends the live VNC/desktop session. Call this when you are finished using the desktop screen or when the user asks to close/stop the desktop.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const sandbox = await getSandbox();
        await clearActiveDesktopSessionInfo(contextKey).catch(() => {});
        await sandbox.computerUse.stop().catch(() => {});
        return {
          success: true,
          message:
            "Daytona desktop processes stopped and session closed successfully",
        };
      } catch (err: any) {
        await clearActiveDesktopSessionInfo(contextKey).catch(() => {});
        return {
          success: false,
          error: `Failed to stop desktop processes: ${err.message}`,
        };
      }
    },
  });

  return {
    browser_navigate: browserNavigate,
    browser_extract_content: browserExtractContent,
    browser_wait_for_user: browserWaitForUser,
    browser_close: browserClose,
  };
}
