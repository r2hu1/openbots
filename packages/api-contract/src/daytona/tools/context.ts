import type { Sandbox } from "@daytona/sdk";
import {
  ensureDesktopLiveView,
  getAgentSandbox,
  setActiveDesktopSessionInfo,
} from "../sandbox.js";

export interface CreateDaytonaToolsOptions {
  sandboxId?: string | null;
  agentId?: string;
  agentName?: string;
  contextKey: string;
}

export interface DaytonaSandboxContext {
  getSandbox: () => Promise<Sandbox>;
  getLiveView: (sandbox: Sandbox) => Promise<string | undefined>;
  options: CreateDaytonaToolsOptions;
}

export function createDaytonaSandboxContext(
  options: CreateDaytonaToolsOptions,
): DaytonaSandboxContext {
  const { sandboxId: initialSandboxId, agentId, agentName, contextKey } = options;
  let currentSandboxId = initialSandboxId;

  async function getSandbox(): Promise<Sandbox> {
    // 1. Try existing sandbox if ID is present
    if (currentSandboxId) {
      const existingSandbox = await getAgentSandbox(currentSandboxId);
      if (existingSandbox) {
        return existingSandbox;
      }
      console.warn(
        `Daytona sandbox '${currentSandboxId}' not found or unreachable. Attempting auto-recreation...`,
      );
    }

    // 2. Auto-provision / self-heal sandbox if missing or expired
    const effectiveName = agentName || "agent";
    const { createAgentSandbox } = await import("../sandbox.js");
    const newSandboxId = await createAgentSandbox(effectiveName);

    if (!newSandboxId) {
      throw new Error(
        "Daytona sandbox is not available. Please ensure DAYTONA_API_KEY is configured in your environment.",
      );
    }

    currentSandboxId = newSandboxId;

    // Persist new sandboxId to database if agentId is available
    if (agentId) {
      try {
        const { db, agents } = await import("@openbots/db");
        const { eq } = await import("drizzle-orm");
        await db
          .update(agents)
          .set({ sandboxId: newSandboxId })
          .where(eq(agents.id, agentId));
      } catch (dbErr) {
        console.warn(
          "Failed to update agent with new Daytona sandbox ID:",
          dbErr,
        );
      }
    }

    const newSandbox = await getAgentSandbox(newSandboxId);
    if (!newSandbox) {
      throw new Error(
        `Failed to connect to newly created Daytona sandbox '${newSandboxId}'.`,
      );
    }

    return newSandbox;
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

  return {
    getSandbox,
    getLiveView,
    options,
  };
}
