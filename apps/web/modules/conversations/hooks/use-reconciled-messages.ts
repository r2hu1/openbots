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

    // Append optimistic user messages that haven't been persisted to serverMessages yet.
    // NOTE: Only compare against the most recent server message or server messages that arrived
    // AFTER the optimistic message was created. Checking the entire conversation history causes
    // repeated prompts (e.g. "hi", "test", "run again") to falsely match older messages and vanish!
    if (optimisticMessages.length > 0) {
      // Find user messages in serverMessages that are at the very end of the conversation
      // (created around or after the optimistic message)
      const recentServerUserMsgs = serverMessages
        .slice(-Math.max(optimisticMessages.length + 3, 5))
        .filter((m) => m.role === "user");

      for (let i = 0; i < optimisticMessages.length; i++) {
        const opt = optimisticMessages[i]!;
        if (opt.role !== "user") continue;
        const optText = normalizeForComparison(getMessageText(opt.content));
        if (!optText) continue;

        const optTime = new Date(opt.createdAt).getTime();

        // An optimistic message is considered already persisted ONLY if a server user message
        // with the exact same content was created around or after the optimistic timestamp (within 60s)
        const isPersistedInRecent = recentServerUserMsgs.some((srv) => {
          const srvText = normalizeForComparison(getMessageText(srv.content));
          if (srvText !== optText) return false;
          const srvTime = new Date(srv.createdAt).getTime();
          // Allow loose clock skew: server message created within 60s of optTime or newer
          return Math.abs(srvTime - optTime) < 60000 || srvTime >= optTime;
        });

        if (!isPersistedInRecent) {
          // Place optimistic messages after all server messages with a stable
          // offset so they stay ordered at the bottom of the chat
          result.push({
            ...opt,
            createdAt: new Date(Math.max(latestServerTs, Date.now()) + 1 + i),
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
          // Find the latest timestamp currently in result (including any optimistic user message)
          let latestResultTs = latestServerTs;
          for (const m of result) {
            const t = new Date(m.createdAt).getTime();
            if (t > latestResultTs) latestResultTs = t;
          }
          const runCompletedTs = activeRun.completedAt
            ? new Date(activeRun.completedAt).getTime()
            : Date.now();

          // Ensure the assistant output timestamp is strictly after the latest user message
          const assistantCreatedAt = new Date(
            Math.max(latestResultTs + 1, runCompletedTs)
          );

          result.push({
            id: `run-asst-${activeRun.id}`,
            conversationId: activeConversationId || "temp",
            role: "assistant",
            content: { text: completedOutputText },
            createdAt: assistantCreatedAt,
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

    // Create an index map of the natural server messages sequence to preserve stable server ordering
    const serverIndexMap = new Map<string, number>();
    serverMessages.forEach((m, idx) => {
      serverIndexMap.set(m.id, idx);
    });

    // Chronological ordering with robust stability
    return deduplicated.sort((a, b) => {
      // 1. If both messages originated from serverMessages, strictly preserve the server's chronological sequence
      const serverIdxA = serverIndexMap.get(a.id);
      const serverIdxB = serverIndexMap.get(b.id);
      if (serverIdxA !== undefined && serverIdxB !== undefined) {
        return serverIdxA - serverIdxB;
      }

      // 2. Otherwise sort by timestamp
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (timeA !== timeB) return timeA - timeB;

      // 3. Sub-second / equal timestamp tie-breaker: user messages always precede assistant messages
      if (a.role === "user" && b.role === "assistant") return -1;
      if (a.role === "assistant" && b.role === "user") return 1;

      return 0;
    });
  }, [serverMessages, optimisticMessages, activeRun, activeConversationId, latestServerTs]);

  // Clear optimistic messages once server messages catch up with recent messages
  React.useEffect(() => {
    if (optimisticMessages.length === 0) return;
    if (serverMessages.length === 0) return;

    const recentServerUserMsgs = serverMessages
      .slice(-Math.max(optimisticMessages.length + 3, 5))
      .filter((m) => m.role === "user");

    const allSaved = optimisticMessages.every((opt) => {
      if (opt.role !== "user") return true;
      const optText = normalizeForComparison(getMessageText(opt.content));
      if (!optText) return true;
      const optTime = new Date(opt.createdAt).getTime();

      return recentServerUserMsgs.some((srv) => {
        const srvText = normalizeForComparison(getMessageText(srv.content));
        if (srvText !== optText) return false;
        const srvTime = new Date(srv.createdAt).getTime();
        return Math.abs(srvTime - optTime) < 60000 || srvTime >= optTime;
      });
    });

    if (allSaved) {
      onClearOptimistic();
    }
  }, [serverMessages, optimisticMessages, onClearOptimistic]);

  return messages;
}
