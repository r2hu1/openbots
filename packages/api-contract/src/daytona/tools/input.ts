import { tool } from "ai";
import { z } from "zod";
import type { DaytonaSandboxContext } from "./context.js";

export function createDaytonaInputTools(
  ctx: DaytonaSandboxContext,
): Record<string, any> {
  const { getSandbox, getLiveView } = ctx;

  const mouseClick = tool({
    description:
      "Clicks the mouse at specified desktop screen coordinates (x, y) or clicks an accessibility element in the Daytona desktop.",
    inputSchema: z.object({
      x: z.number().optional().describe("X screen coordinate (e.g. 0 to 1280)"),
      y: z.number().optional().describe("Y screen coordinate (e.g. 0 to 800)"),
      button: z
        .enum(["left", "right", "middle"])
        .default("left")
        .describe("Mouse button to click"),
      doubleClick: z
        .boolean()
        .default(false)
        .describe("Perform a double click"),
      elementName: z
        .string()
        .optional()
        .describe(
          "Accessible UI element name to find and click via AT-SPI accessibility tree",
        ),
    }),
    execute: async ({ x, y, button, doubleClick, elementName }) => {
      try {
        const sandbox = await getSandbox();
        await sandbox.computerUse.start().catch(() => {});

        const liveViewUrl = await getLiveView(sandbox);

        if (x !== undefined && y !== undefined) {
          await sandbox.computerUse.mouse.click(x, y, button, doubleClick);
          return {
            success: true,
            message: `Mouse ${doubleClick ? "double-" : ""}${button}-clicked at (${x}, ${y})`,
            liveViewUrl,
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
            await sandbox.computerUse.accessibility.invokeNode(
              node.id,
              "click",
            );
            return {
              success: true,
              message: `Clicked accessibility element '${elementName}' (ID: ${node.id})`,
              liveViewUrl,
              sandboxId: sandbox.id,
            };
          }
          return {
            success: false,
            error: `Element '${elementName}' not found in desktop accessibility tree`,
            liveViewUrl,
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
    description:
      "Moves the mouse cursor to specified desktop coordinates (x, y).",
    inputSchema: z.object({
      x: z.number().describe("Target X coordinate (0 to 1280)"),
      y: z.number().describe("Target Y coordinate (0 to 800)"),
    }),
    execute: async ({ x, y }) => {
      try {
        const sandbox = await getSandbox();
        await sandbox.computerUse.start().catch(() => {});
        const liveViewUrl = await getLiveView(sandbox);
        const res = await sandbox.computerUse.mouse.move(x, y);

        return {
          success: true,
          message: `Moved mouse cursor to (${res.x}, ${res.y})`,
          x: res.x,
          y: res.y,
          liveViewUrl,
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
    description:
      "Scrolls the mouse wheel up or down at the specified screen coordinates.",
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
        const liveViewUrl = await getLiveView(sandbox);
        await sandbox.computerUse.mouse.scroll(x, y, direction, amount);

        return {
          success: true,
          message: `Scrolled ${direction} by ${amount} ticks at (${x}, ${y})`,
          liveViewUrl,
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
    description:
      "Types text into the active focused window or input field in the Daytona desktop environment.",
    inputSchema: z.object({
      text: z.string().describe("The text string to type"),
      pressEnter: z
        .boolean()
        .default(false)
        .describe("Press Enter after typing the text"),
      delayMs: z
        .number()
        .default(20)
        .describe("Delay between key strokes in ms"),
    }),
    execute: async ({ text, pressEnter, delayMs }) => {
      try {
        const sandbox = await getSandbox();
        await sandbox.computerUse.start().catch(() => {});
        const liveViewUrl = await getLiveView(sandbox);
        await sandbox.computerUse.keyboard.type(text, delayMs);
        if (pressEnter) {
          await sandbox.computerUse.keyboard.press("enter");
        }

        return {
          success: true,
          message: `Typed text into desktop (${text.length} characters)`,
          liveViewUrl,
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

  return {
    mouse_click: mouseClick,
    mouse_move: mouseMove,
    mouse_scroll: mouseScroll,
    keyboard_type: keyboardType,
  };
}
