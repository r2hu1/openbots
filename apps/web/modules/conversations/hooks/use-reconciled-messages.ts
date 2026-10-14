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

/**
 * Normalise text for dedup comparison: trim, collapse whitespace, lowercase.
 */
function normalizeForComparison(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function useReconciledMessages({
  serverMessages,
  optimisticMessages,
  activeRun,
  activeConversationId,
  onClearOptimistic,
}: UseReconciledMessagesOptions) {
  // Track the latest server timestamp so optimistic messages are placed after it
  const latestServerTs = React.useMemo(() => {
    let max = 0;
    for (const m of serverMessages) {
      const t = new Date(m.createdAt).getTime();
      if (t > max) max = t;
    }
    return max;
  }, [serverMessages]);

  const messages = React.useMemo(() => {
    const result: MessageItem[] = [...serverMessages];

    // Build a set of normalised server user-message texts for fast lookup
    const serverUserTexts = new Set<string>();
    for (const srv of serverMessages) {
      if (srv.role === "user") {
        const t = normalizeForComparison(getMessageText(srv.content));
        if (t) serverUserTexts.add(t);
      }
    }

    // Append optimistic user messages that haven't been persisted yet
    if (optimisticMessages.length > 0) {
      for (let i = 0; i < optimisticMessages.length; i++) {
        const opt = optimisticMessages[i]!;
        if (opt.role !== "user") continue;
        const optText = normalizeForComparison(getMessageText(opt.content));
        if (!optText) continue;

        if (!serverUserTexts.has(optText)) {
          // Place optimistic messages after all server messages with a stable
          // offset so they stay ordered among themselves
          result.push({
            ...opt,
            createdAt: new Date(latestServerTs + 1 + i),
          });
        }
      }
    }

    // If an active run has just completed and serverMessages hasn't caught up, show the output
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
        const normalizedOutput = normalizeForComparison(completedOutputText);
        const hasResponseAlready = result.some((m) => {
          if (m.role !== "assistant") return false;
          return normalizeForComparison(getMessageText(m.content)) === normalizedOutput;
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

    // Chronological ordering with role tie-breaker
    return deduplicated.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (timeA !== timeB) return timeA - timeB;
      if (a.role === "user" && b.role === "assistant") return -1;
      if (a.role === "assistant" && b.role === "user") return 1;
      return 0;
    });
  }, [serverMessages, optimisticMessages, activeRun, activeConversationId, latestServerTs]);

  // Clear optimistic messages once server messages catch up
  React.useEffect(() => {
    if (optimisticMessages.length === 0) return;
    if (serverMessages.length === 0) return;

    const serverUserTexts = new Set<string>();
    for (const srv of serverMessages) {
      if (srv.role === "user") {
        const t = normalizeForComparison(getMessageText(srv.content));
        if (t) serverUserTexts.add(t);
      }
    }

    const allSaved = optimisticMessages.every((opt) => {
      if (opt.role !== "user") return true;
      const optText = normalizeForComparison(getMessageText(opt.content));
      if (!optText) return true;
      return serverUserTexts.has(optText);
    });

    if (allSaved) {
      onClearOptimistic();
    }
  }, [serverMessages, optimisticMessages, onClearOptimistic]);

  return messages;
}
