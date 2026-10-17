import { randomUUID } from "node:crypto";
import type { Sandbox } from "@daytona/sdk";
import { getStoragePublicUrl, uploadStorageObject } from "@openbots/db";
import { tool } from "ai";
import { z } from "zod";
import type { DaytonaSandboxContext } from "./context.js";

/**
 * Helper to capture a reliable desktop screenshot using ffmpeg x11grab or SDK computerUse.
 */
async function captureDesktopFrame(sandbox: Sandbox): Promise<Buffer | null> {
  // 1. Try SDK screenshot first
  try {
    const screenshot = await sandbox.computerUse.screenshot.takeCompressed({
      format: "jpeg",
      quality: 85,
      showCursor: true,
    });
    if (screenshot.screenshot) {
      return Buffer.from(screenshot.screenshot, "base64");
    }
  } catch (e: any) {
    console.warn(
      "SDK computerUse.screenshot error, falling back to x11 capture:",
      e?.message,
    );
  }

  // 2. Fallback to native X11 ffmpeg x11grab (always pre-installed on Daytona desktop images)
  try {
    const tmpFile = `/tmp/frame_${Date.now()}.jpg`;
    const captureCmd = `DISPLAY=:0 sh -c '
if command -v ffmpeg >/dev/null 2>&1; then
  ffmpeg -v error -f x11grab -i :0.0 -vframes 1 "${tmpFile}" -y
elif command -v scrot >/dev/null 2>&1; then
  scrot -q 85 "${tmpFile}"
elif command -v import >/dev/null 2>&1; then
  import -window root "${tmpFile}"
fi
'`;
    await sandbox.process.executeCommand(captureCmd);
    const fileBuffer = await sandbox.fs.downloadFile(tmpFile);
    // Clean up tmp file asynchronously
    sandbox.process.executeCommand(`rm -f "${tmpFile}"`).catch(() => {});
    if (fileBuffer && fileBuffer.length > 0) {
      return fileBuffer;
    }
  } catch (cmdErr: any) {
    console.warn("x11 fallback capture error:", cmdErr?.message);
  }

  return null;
}

export function createDaytonaScreenTools(
  ctx: DaytonaSandboxContext,
): Record<string, any> {
  const { getSandbox, getLiveView, options } = ctx;
  const { contextKey } = options;

  const viewScreen = tool({
    description:
      "Captures the desktop screen so YOU (the agent) can visually inspect what is currently on screen. Use this whenever you need to check UI state, verify button positions, read error popups, or see results. Does NOT open the user sidebar.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const sandbox = await getSandbox();
        await sandbox.computerUse.start().catch(() => {});

        const buffer = await captureDesktopFrame(sandbox);
        if (!buffer) {
          return {
            success: false,
            error:
              "Failed to view screen: empty frame data returned or display connection interrupted",
          };
        }

        const dataUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;

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

  const showScreen = tool({
    description:
      "Opens the live desktop preview sidebar in the user's interface so they can watch the live screen, view the desktop, or take over control. Call this when the user asks to see the screen (e.g. 'show me the screen', 'open live preview', 'let me watch').",
    inputSchema: z.object({
      reason: z
        .string()
        .optional()
        .describe("Why the screen preview is being shown to the user"),
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

        const buffer = await captureDesktopFrame(sandbox);
        if (!buffer) {
          return {
            success: false,
            error:
              "Failed to capture desktop screenshot: empty frame data returned or display connection interrupted",
          };
        }
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
          console.warn(
            "Failed to upload screenshot to Supabase storage:",
            storageErr,
          );
        }

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

  return {
    view_screen: viewScreen,
    show_screen: showScreen,
    take_screenshot: takeScreenshot,
  };
}
