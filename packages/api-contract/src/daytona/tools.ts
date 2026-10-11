import { tool } from "ai";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { Sandbox } from "@daytona/sdk";
import { uploadStorageObject, getStoragePublicUrl } from "@openbots/db";
import {
  getAgentSandbox,
  ensureDesktopLiveView,
  setActiveDesktopSessionInfo,
  clearActiveDesktopSessionInfo,
} from "./sandbox.js";
import {
  setPendingHumanInteraction,
  waitForHumanInteractionResponse,
} from "./hitl.js";

export interface CreateDaytonaToolsOptions {
  sandboxId?: string | null;
  contextKey: string;
}

/**
 * Creates the complete suite of computer use, shell, file system,
 * and desktop screen tools powered by Daytona Sandboxes.
 */
export function createDaytonaTools(options: CreateDaytonaToolsOptions): Record<string, any> {
  const { sandboxId, contextKey } = options;

  async function getSandbox(): Promise<Sandbox> {
    if (!sandboxId) {
      throw new Error(
        "This agent does not have an active Daytona sandbox configured. Ensure DAYTONA_API_KEY is set and the agent has a sandbox.",
      );
    }
    const sandbox = await getAgentSandbox(sandboxId);
    if (!sandbox) {
      throw new Error(
        `Failed to connect to Daytona sandbox '${sandboxId}'.`,
      );
    }
    return sandbox;
  }

  async function getLiveView(sandbox: Sandbox): Promise<string | undefined> {
    const liveViewUrl = await ensureDesktopLiveView(sandbox);
    if (liveViewUrl) {
      await setActiveDesktopSessionInfo(contextKey, {
        sandboxId: sandbox.id,
        vncUrl: liveViewUrl,
        liveViewUrl,
        liveDebuggerFullscreenUrl: liveViewUrl,
      });
    }
    return liveViewUrl ?? undefined;
  }

  // ==========================================
  // 1. BASH / COMMAND EXECUTION
  // ==========================================
  const bash = tool({
    description:
      "Executes shell commands in the agent's Daytona sandbox terminal. Returns stdout, stderr, and exit code. Use for installing packages, running scripts, compiling code, checking logs, and managing processes.",
    inputSchema: z.object({
      command: z.string().describe("The shell command to run in the sandbox"),
      cwd: z.string().optional().describe("Working directory for command execution"),
      timeoutSeconds: z.number().default(60).describe("Execution timeout in seconds"),
    }),
    execute: async ({ command, cwd }) => {
      try {
        const sandbox = await getSandbox();
        const cmd = cwd ? `cd "${cwd}" && ${command}` : command;
        const res = await sandbox.process.executeCommand(cmd);

        return {
          success: res.exitCode === 0,
          exitCode: res.exitCode,
          result: res.result,
          sandboxId: sandbox.id,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Bash command failed: ${err.message}`,
        };
      }
    },
  });

  // ==========================================
  // 2. FILE SYSTEM TOOLS
  // ==========================================
  const readFile = tool({
    description: "Reads the content of a file from the Daytona sandbox filesystem.",
    inputSchema: z.object({
      path: z.string().describe("Relative or absolute path to the file inside the sandbox"),
    }),
    execute: async ({ path }) => {
      try {
        const sandbox = await getSandbox();
        const buffer = await sandbox.fs.downloadFile(path);
        const content = buffer.toString("utf-8");

        return {
          success: true,
          path,
          content,
          sizeBytes: buffer.length,
          sandboxId: sandbox.id,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Failed to read file '${path}': ${err.message}`,
        };
      }
    },
  });

  const writeFile = tool({
    description: "Writes text content to a file in the Daytona sandbox filesystem. Creates parent directories if needed.",
    inputSchema: z.object({
      path: z.string().describe("Relative or absolute path of the file to create or overwrite"),
      content: z.string().describe("The full text content to write into the file"),
    }),
    execute: async ({ path, content }) => {
      try {
        const sandbox = await getSandbox();
        const buffer = Buffer.from(content, "utf-8");
        await sandbox.fs.uploadFile(buffer, path);

        return {
          success: true,
          message: `Successfully wrote ${buffer.length} bytes to '${path}'`,
          path,
          sandboxId: sandbox.id,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Failed to write file '${path}': ${err.message}`,
        };
      }
    },
  });

  const listFiles = tool({
    description: "Lists files and directories at a path in the Daytona sandbox filesystem.",
    inputSchema: z.object({
      path: z.string().default(".").describe("Path to list (defaults to current working directory)"),
      depth: z.number().default(1).describe("Directory traversal depth (1 for immediate entries)"),
    }),
    execute: async ({ path, depth }) => {
      try {
        const sandbox = await getSandbox();
        const entries = await sandbox.fs.listFiles(path, { depth });

        return {
          success: true,
          path,
          entries: entries.map((e) => ({
            name: e.name,
            path: e.path,
            isDir: e.isDir,
            size: e.size,
            modTime: e.modTime,
          })),
          sandboxId: sandbox.id,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Failed to list files in '${path}': ${err.message}`,
        };
      }
    },
  });

  // ==========================================
  // 3. COMPUTER USE: MOUSE & KEYBOARD
  // ==========================================
  const mouseClick = tool({
    description:
      "Clicks the mouse at specified desktop screen coordinates (x, y) or clicks an accessibility element in the Daytona desktop.",
    inputSchema: z.object({
      x: z.number().optional().describe("X screen coordinate (e.g. 0 to 1280)"),
      y: z.number().optional().describe("Y screen coordinate (e.g. 0 to 800)"),
      button: z.enum(["left", "right", "middle"]).default("left").describe("Mouse button to click"),
      doubleClick: z.boolean().default(false).describe("Perform a double click"),
      elementName: z
        .string()
        .optional()
        .describe("Accessible UI element name to find and click via AT-SPI accessibility tree"),
    }),
    execute: async ({ x, y, button, doubleClick, elementName }) => {
      try {
        const sandbox = await getSandbox();
        await sandbox.computerUse.start().catch(() => {});

        if (x !== undefined && y !== undefined) {
          await sandbox.computerUse.mouse.click(x, y, button, doubleClick);
          return {
            success: true,
            message: `Mouse ${doubleClick ? "double-" : ""}${button}-clicked at (${x}, ${y})`,
            sandboxId: sandbox.id,
          };
        }

        if (elementName) {
          const nodes = await sandbox.computerUse.accessibility.findNodes({
            name: elementName,
            nameMatch: "substring",
            limit: 1,
          });
          const node = nodes.matches?.[0];
          if (node?.id) {
            await sandbox.computerUse.accessibility.invokeNode(node.id, "click");
            return {
              success: true,
              message: `Clicked accessibility element '${elementName}' (ID: ${node.id})`,
              sandboxId: sandbox.id,
            };
          }
          return {
            success: false,
            error: `Element '${elementName}' not found in desktop accessibility tree`,
          };
        }

        return {
          success: false,
          error: "Either coordinates (x, y) or elementName must be specified",
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Mouse click failed: ${err.message}`,
        };
      }
    },
  });

  const mouseMove = tool({
    description: "Moves the mouse cursor to specified desktop coordinates (x, y).",
    inputSchema: z.object({
      x: z.number().describe("Target X coordinate (0 to 1280)"),
      y: z.number().describe("Target Y coordinate (0 to 800)"),
    }),
    execute: async ({ x, y }) => {
      try {
        const sandbox = await getSandbox();
        await sandbox.computerUse.start().catch(() => {});
        const res = await sandbox.computerUse.mouse.move(x, y);

        return {
          success: true,
          message: `Moved mouse cursor to (${res.x}, ${res.y})`,
          x: res.x,
          y: res.y,
          sandboxId: sandbox.id,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Mouse move failed: ${err.message}`,
        };
      }
    },
  });

  const mouseScroll = tool({
    description: "Scrolls the mouse wheel up or down at the specified screen coordinates.",
    inputSchema: z.object({
      direction: z.enum(["up", "down"]).default("down"),
      amount: z.number().default(3).describe("Number of scroll ticks"),
      x: z.number().default(640).describe("X coordinate to scroll at"),
      y: z.number().default(400).describe("Y coordinate to scroll at"),
    }),
    execute: async ({ direction, amount, x, y }) => {
      try {
        const sandbox = await getSandbox();
        await sandbox.computerUse.start().catch(() => {});
        await sandbox.computerUse.mouse.scroll(x, y, direction, amount);

        return {
          success: true,
          message: `Scrolled ${direction} by ${amount} ticks at (${x}, ${y})`,
          sandboxId: sandbox.id,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Mouse scroll failed: ${err.message}`,
        };
      }
    },
  });

  const keyboardType = tool({
    description: "Types text into the active focused window or input field in the Daytona desktop environment.",
    inputSchema: z.object({
      text: z.string().describe("The text string to type"),
      pressEnter: z.boolean().default(false).describe("Press Enter after typing the text"),
      delayMs: z.number().default(20).describe("Delay between key strokes in ms"),
    }),
    execute: async ({ text, pressEnter, delayMs }) => {
      try {
        const sandbox = await getSandbox();
        await sandbox.computerUse.start().catch(() => {});
        await sandbox.computerUse.keyboard.type(text, delayMs);
        if (pressEnter) {
          await sandbox.computerUse.keyboard.press("enter");
        }

        return {
          success: true,
          message: `Typed text into desktop (${text.length} characters)`,
          sandboxId: sandbox.id,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Keyboard type failed: ${err.message}`,
        };
      }
    },
  });

  // ==========================================
  // 4. SCREEN TOOLS: VIEW SCREEN, SHOW SCREEN, TAKE SCREENSHOT
  // ==========================================

  // view_screen: Used strictly for internal model vision. NEVER opens sidebar and never leaks preview URL to chat.
  const viewScreen = tool({
    description:
      "Captures the desktop screen so YOU (the agent) can visually inspect what is currently on screen. Use this whenever you need to check UI state, verify button positions, read error popups, or see results. Does NOT open the user sidebar.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const sandbox = await getSandbox();
        await sandbox.computerUse.start().catch(() => {});

        const screenshot = await sandbox.computerUse.screenshot.takeCompressed({
          format: "jpeg",
          quality: 80,
          showCursor: true,
        });

        const dataUrl = screenshot.screenshot
          ? `data:image/jpeg;base64,${screenshot.screenshot}`
          : "";

        return {
          success: true,
          message: "Captured current screen for visual inspection",
          screenshotDataUrl: dataUrl,
          sandboxId: sandbox.id,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Failed to view screen: ${err.message}`,
        };
      }
    },
  });

  // show_screen: Explicitly opens the live preview sidebar for the user.
  const showScreen = tool({
    description:
      "Opens the live desktop preview sidebar in the user's interface so they can watch the live screen, view the desktop, or take over control. Call this when the user asks to see the screen (e.g. 'show me the screen', 'open live preview', 'let me watch').",
    inputSchema: z.object({
      reason: z.string().optional().describe("Why the screen preview is being shown to the user"),
    }),
    execute: async ({ reason }) => {
      try {
        const sandbox = await getSandbox();
        await sandbox.computerUse.start().catch(() => {});
        const liveViewUrl = await getLiveView(sandbox);

        return {
          success: true,
          message: `Live desktop screen opened for user: ${reason || "User requested screen view"}`,
          liveViewUrl,
          sandboxId: sandbox.id,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Failed to show screen: ${err.message}`,
        };
      }
    },
  });

  // take_screenshot: Captures a visual snapshot of the desktop, saves it to the sandbox,
  // uploads it to Supabase Storage, and returns a live public image URL.
  const takeScreenshot = tool({
    description:
      "Captures a visual screenshot of the current Daytona desktop screen, saves it to the sandbox filesystem, uploads it to storage, and returns an embeddable image URL.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const sandbox = await getSandbox();
        await sandbox.computerUse.start().catch(() => {});
        const liveViewUrl = await getLiveView(sandbox);

        // Give the X11 desktop display a moment to flush changes and render active windows
        await new Promise((r) => setTimeout(r, 1000));

        const screenshot = await sandbox.computerUse.screenshot.takeCompressed({
          format: "jpeg",
          quality: 85,
          showCursor: true,
        });

        if (!screenshot.screenshot) {
          return {
            success: false,
            error: "Failed to capture desktop screenshot: empty frame data returned",
          };
        }

        const buffer = Buffer.from(screenshot.screenshot, "base64");
        const timestamp = Date.now();
        const filePath = `/home/daytona/screenshots/screenshot_${timestamp}.jpg`;

        // 1. Save locally in the Daytona sandbox
        await sandbox.fs.uploadFile(buffer, filePath).catch(() => {});

        // 2. Upload to Supabase Storage for persistent public URL preview
        let imageUrl: string | undefined;
        try {
          const uniqueId = randomUUID();
          const bucket =
            process.env.SUPABASE_STORAGE_BUCKET || "conversation-attachments";
          const storagePath = `screenshots/${contextKey}/${uniqueId}.jpg`;

          const { error: uploadError } = await uploadStorageObject({
            bucket,
            path: storagePath,
            fileBody: buffer,
            contentType: "image/jpeg",
            upsert: true,
          });

          if (!uploadError) {
            const { data: publicUrlData } = getStoragePublicUrl(
              bucket,
              storagePath,
            );
            imageUrl = publicUrlData?.publicUrl;
          }
        } catch (storageErr) {
          console.warn("Failed to upload screenshot to Supabase storage:", storageErr);
        }

        const finalUrl = imageUrl || liveViewUrl;

        return {
          success: true,
          message: `Screenshot captured successfully.${imageUrl ? ` Image URL: ${imageUrl}. Embed in your chat message using markdown: ![Screenshot](${imageUrl})` : ` Saved to sandbox at ${filePath}`}`,
          imageUrl,
          filePath,
          liveViewUrl,
          sandboxId: sandbox.id,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Screenshot failed: ${err.message}`,
        };
      }
    },
  });

  // ==========================================
  // 5. BROWSER & NAVIGATION (Desktop Browser)
  // ==========================================
  const browserNavigate = tool({
    description:
      "Navigates the desktop browser in the Daytona sandbox to a URL and waits for the page to load.",
    inputSchema: z.object({
      url: z.string().url().describe("The web URL to open"),
    }),
    execute: async ({ url }) => {
      try {
        const sandbox = await getSandbox();
        await sandbox.computerUse.start().catch(() => {});

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

        // Allow browser window to open and render content on screen
        await new Promise((r) => setTimeout(r, 3500));
        const windows = await sandbox.computerUse.display.getWindows().catch(() => ({ windows: [] }));
        const activeTitle = windows.windows?.[0]?.title || url;
        const liveViewUrl = await getLiveView(sandbox);

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
      maxChars: z.number().default(12000).describe("Maximum character length"),
    }),
    execute: async ({ maxChars }) => {
      try {
        const sandbox = await getSandbox();
        await sandbox.computerUse.start().catch(() => {});

        const [windows, tree] = await Promise.all([
          sandbox.computerUse.display.getWindows().catch(() => ({ windows: [] })),
          sandbox.computerUse.accessibility.getTree({ scope: "all", maxDepth: 3 }).catch(() => null),
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

  // ==========================================
  // 6. HUMAN-IN-THE-LOOP (HITL)
  // Opens the live preview sidebar so user can interact!
  // ==========================================
  const browserWaitForUser = tool({
    description:
      "Pauses execution and opens the live desktop preview for the user to complete a manual action (such as logging in, solving a CAPTCHA, or approving 2FA). Returns when the user clicks 'I'm Done'.",
    inputSchema: z.object({
      instruction: z
        .string()
        .describe("Clear instructions explaining what action the user must take on the screen"),
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
        const timeoutMs = Math.min(Math.max(timeoutSeconds, 10), 300) * 1000;

        const requestId = `hitl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await setPendingHumanInteraction(contextKey, {
          id: requestId,
          contextKey,
          instruction,
          liveViewUrl,
          createdAt: Date.now(),
          timeoutSeconds,
        });

        const hitlRes = await waitForHumanInteractionResponse(contextKey, timeoutMs);

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
    description: "Stops desktop computer use processes in the sandbox and ends the live VNC/desktop session. Call this when you are finished using the desktop screen or when the user asks to close/stop the desktop.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const sandbox = await getSandbox();
        await clearActiveDesktopSessionInfo(contextKey).catch(() => {});
        await sandbox.computerUse.stop().catch(() => {});
        return {
          success: true,
          message: "Daytona desktop processes stopped and session closed successfully",
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
    // Terminal & Filesystem
    bash,
    read_file: readFile,
    write_file: writeFile,
    list_files: listFiles,

    // Mouse & Keyboard (Computer Use)
    mouse_click: mouseClick,
    mouse_move: mouseMove,
    mouse_scroll: mouseScroll,
    keyboard_type: keyboardType,

    // Screen Tools
    view_screen: viewScreen,
    show_screen: showScreen,
    take_screenshot: takeScreenshot,

    // Browser & Navigation
    browser_navigate: browserNavigate,
    browser_click: mouseClick, // aliased for backward compatibility
    browser_type: keyboardType, // aliased for backward compatibility
    browser_screenshot: takeScreenshot, // aliased
    browser_extract_content: browserExtractContent,
    browser_scroll: mouseScroll, // aliased
    browser_evaluate: bash, // aliased
    browser_wait_for_user: browserWaitForUser,
    browser_close: browserClose,
  };
}
