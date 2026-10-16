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
    if (optimisticMessages.length > 0) {
      const recentServerUserMsgs = serverMessages
        .slice(-Math.max(optimisticMessages.length + 5, 8))
        .filter((m) => m.role === "user");

      for (let i = 0; i < optimisticMessages.length; i++) {
        const opt = optimisticMessages[i]!;
        if (opt.role !== "user") continue;
        const optText = normalizeForComparison(getMessageText(opt.content));
        if (!optText) continue;

        const optTime = new Date(opt.createdAt).getTime();

        // Synchronously check if serverMessages already has this user message
        const isPersistedInRecent = recentServerUserMsgs.some((srv) => {
          const srvText = normalizeForComparison(getMessageText(srv.content));
          if (srvText !== optText) return false;
          const srvTime = new Date(srv.createdAt).getTime();
          return Math.abs(srvTime - optTime) < 60000 || srvTime >= optTime;
        });

        if (!isPersistedInRecent) {
          // Never inflate the optimistic message timestamp beyond the server assistant's timestamp.
          // Keep the optimistic message's own creation timestamp if it's already after server messages,
          // or place it strictly right after earlier messages, but never re-bump it to Date.now()
          // after an assistant response has arrived.
          const optTimestamp = Math.max(
            new Date(opt.createdAt).getTime(),
            latestServerTs > 0 ? latestServerTs + 1 + i : Date.now() + i
          );

          result.push({
            ...opt,
            createdAt: new Date(optTimestamp),
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

        // Check if ANY assistant message in the conversation already matches this output
        // or if serverMessages already has an assistant message created at or after run start/completion
        const hasResponseAlready = result.some((m) => {
          if (m.role !== "assistant") return false;
          if (
            m.id === `run-asst-${activeRun.id}` ||
            m.id === `opt-assistant-${activeRun.id}` ||
            m.id.includes(activeRun.id)
          ) {
            return true;
          }
          const text = normalizeForComparison(getMessageText(m.content));
          if (!text) return false;
          if (text === normalizedOutput || text.includes(normalizedOutput) || normalizedOutput.includes(text)) {
            return true;
          }
          // Also match on initial/prefix prefix of text if long response
          const minLen = Math.min(text.length, normalizedOutput.length);
          if (minLen >= 40) {
            const prefixA = text.slice(0, 100);
            const prefixB = normalizedOutput.slice(0, 100);
            if (prefixA === prefixB) return true;
          }
          return false;
        });

        if (!hasResponseAlready) {
          let latestResultTs = latestServerTs;
          for (const m of result) {
            const t = new Date(m.createdAt).getTime();
            if (t > latestResultTs) latestResultTs = t;
          }
          const runCompletedTs = activeRun.completedAt
            ? new Date(activeRun.completedAt).getTime()
            : Date.now();

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

    // Deduplicate by id and deduplicate duplicate assistant messages
    const seenIds = new Set<string>();
    const seenAssistantContent = new Set<string>();
    const deduplicated = result.filter((m) => {
      if (seenIds.has(m.id)) return false;
      seenIds.add(m.id);

      // If this is an assistant message, ensure we don't duplicate identical content
      // (e.g. synthetic run-asst message alongside an incoming server message with the same content)
      if (m.role === "assistant") {
        const text = normalizeForComparison(getMessageText(m.content));
        if (text) {
          // Use first 150 chars as signature for long responses to prevent false negatives from trailing whitespace
          const key = text.slice(0, 150);
          if (seenAssistantContent.has(key)) {
            return false;
          }
          seenAssistantContent.add(key);
        }
      }

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

      // 2. If one is a server assistant message and the other is an optimistic user message that arrived
      // around the same time or before, ensure user message stays BEFORE assistant message
      if (a.role === "user" && b.role === "assistant") {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        // If user message is <= or within 2 seconds of assistant message, user message comes first
        if (timeA <= timeB + 2000) return -1;
      }
      if (a.role === "assistant" && b.role === "user") {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        // If user message is >= or within 2 seconds of assistant message, user message comes first
        if (timeB <= timeA + 2000) return 1;
      }

      // 3. Otherwise sort by timestamp
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (timeA !== timeB) return timeA - timeB;

      // 4. Sub-second / equal timestamp tie-breaker: user messages always precede assistant messages
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
