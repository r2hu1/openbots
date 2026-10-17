"use client";

import type { MessageItem } from "@/modules/conversations/types";
import type { RunRecord } from "@/modules/runs/types";

export interface UseAgentExecutionOptions {
  agentId: string | null;
  activeConversationId: string | null;
  onConversationCreated?: (id: string) => void;
}

export function createTerminalRunRecord(params: {
  id: string;
  agentId?: string | null;
  conversationId?: string | null;
  status: "completed" | "failed" | "cancelled" | string;
  output?: any;
  error?: string | null;
}): RunRecord {
  return {
    id: params.id,
    userId: "",
    agentId: params.agentId || "",
    conversationId: params.conversationId ?? null,
    status: params.status as "completed" | "failed" | "cancelled",
    triggerType: "manual",
    input: null,
    output: params.output ?? null,
    error: params.error || null,
    startedAt: new Date(),
    completedAt: new Date(),
    createdAt: new Date(),
  };
}

export function createOptimisticMessage(params: {
  prompt: string;
  conversationId?: string | null;
  images?: string[];
  attachments?: Array<{
    url: string;
    path: string;
    name: string;
    mimeType: string;
    sizeBytes?: number;
  }>;
}): MessageItem {
  const tempId = `optimistic-${Date.now()}`;
  return {
    id: tempId,
    conversationId: params.conversationId || "temp",
    role: "user",
    content: {
      text: params.prompt,
      ...(params.images && params.images.length > 0
        ? { images: params.images }
        : {}),
      ...(params.attachments && params.attachments.length > 0
        ? { attachments: params.attachments }
        : {}),
    },
    createdAt: new Date(),
  };
}

export async function verifyRunTerminalState(
  runId: string,
): Promise<RunRecord | null> {
  try {
    const apiBaseUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const headers: Record<string, string> = {};
    if (typeof window !== "undefined") {
      const token =
        localStorage.getItem("bearer_token") ||
        localStorage.getItem("better-auth_token");
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${apiBaseUrl}/api/runs/${runId}`, {
      headers,
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      const run = data?.run;
      if (
        run &&
        (run.status === "completed" ||
          run.status === "failed" ||
          run.status === "cancelled")
      ) {
        return run;
      }
    }
  } catch {
    // ignore verification network error
  }
  return null;
}
