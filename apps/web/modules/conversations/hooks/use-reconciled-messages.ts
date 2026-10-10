"use client";

import * as React from "react";
import type { MessageItem } from "@/modules/conversations/types";
import { getMessageText } from "@/modules/conversations/utils";
import type { RunRecord } from "@/modules/runs/types";

interface UseReconciledMessagesOptions {
  serverMessages: MessageItem[];
  optimisticMessages: MessageItem[];
  activeRun: RunRecord | null;
  activeConversationId: string | null;
  onClearOptimistic: () => void;
}

export function useReconciledMessages({
  serverMessages,
  optimisticMessages,
  activeRun,
  activeConversationId,
  onClearOptimistic,
}: UseReconciledMessagesOptions) {
  const messages = React.useMemo(() => {
    const result: MessageItem[] = [...serverMessages];

    // Append optimistic user messages that are not yet in serverMessages FIRST
    if (optimisticMessages.length > 0) {
      for (const opt of optimisticMessages) {
        if (opt.role !== "user") continue;
        const optText = getMessageText(opt.content).trim();

        const existsInServer = result.some((srv) => {
          if (srv.role !== "user") return false;
          return getMessageText(srv.content).trim() === optText;
        });

        if (!existsInServer) {
          result.push(opt);
        }
      }
    }

    // If an active run has just completed and serverMessages hasn't updated yet, show output AFTER user messages
    if (activeRun && activeRun.status === "completed") {
      const output = activeRun.output;
      const completedOutputText =
        output &&
        typeof output === "object" &&
        "text" in output &&
        typeof (output as { text: unknown }).text === "string"
          ? (output as { text: string }).text.trim()
          : null;

      if (completedOutputText) {
        const hasResponseAlready = result.some((m) => {
          if (m.role !== "assistant") return false;
          return getMessageText(m.content).trim() === completedOutputText;
        });

        if (!hasResponseAlready) {
          result.push({
            id: `run-asst-${activeRun.id}`,
            conversationId: activeConversationId || "temp",
            role: "assistant",
            content: { text: completedOutputText },
            createdAt: activeRun.completedAt || new Date(),
          });
        }
      }
    }

    // Deduplicate by id
    const seenIds = new Set<string>();
    const deduplicated = result.filter((m) => {
      if (seenIds.has(m.id)) return false;
      seenIds.add(m.id);
      return true;
    });

    // Ensure strictly chronological ordering with role tie-breaker
    // (user messages precede assistant messages if timestamps match)
    return deduplicated.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (timeA !== timeB) return timeA - timeB;
      if (a.role === "user" && b.role === "assistant") return -1;
      if (a.role === "assistant" && b.role === "user") return 1;
      return 0;
    });
  }, [serverMessages, optimisticMessages, activeRun, activeConversationId]);

  // Clear optimistic messages once server messages actually catch up with them
  React.useEffect(() => {
    if (optimisticMessages.length === 0) return;

    if (serverMessages.length > 0) {
      const allUserMessagesSaved = optimisticMessages.every((opt) => {
        if (opt.role !== "user") return true;
        const optText = getMessageText(opt.content).trim();
        if (!optText) return true;

        return serverMessages.some((srv) => {
          if (srv.role !== "user") return false;
          return getMessageText(srv.content).trim() === optText;
        });
      });

      if (allUserMessagesSaved) {
        onClearOptimistic();
      }
    }
  }, [serverMessages, optimisticMessages, onClearOptimistic]);

  return messages;
}
