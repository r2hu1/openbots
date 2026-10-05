'use client';

import * as React from "react";
import type { MessageItem } from "@/modules/conversations/types";
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
    const serverMsgMap = new Map<string, MessageItem>(serverMessages.map((m) => [m.id, m]));

    // Handle completed run output
    if (activeRun && activeRun.status === "completed") {
      const output = activeRun.output;
      const completedOutputText =
        output && typeof output === "object" && "text" in output
          ? (output as { text: string }).text.trim()
          : null;

      if (completedOutputText && !serverMsgMap.has(`opt-assistant-${activeRun.id}`)) {
        result.push({
          id: `opt-assistant-${activeRun.id}`,
          conversationId: activeConversationId || "temp",
          role: "assistant",
          content: { text: completedOutputText },
          createdAt: activeRun.completedAt || new Date(),
        });
      }
    }

    // Append optimistic user messages not yet in serverMessages
    for (const opt of optimisticMessages) {
      if (opt.role === 'user' && !serverMsgMap.has(opt.id)) {
        result.push(opt);
      }
    }

    return result;
  }, [serverMessages, optimisticMessages, activeRun, activeConversationId]);

  // Clear optimistic messages once server messages catch up or run finishes
  React.useEffect(() => {
    if (optimisticMessages.length === 0) return;
    
    if (activeRun && (activeRun.status === "completed" || activeRun.status === "failed")) {
      onClearOptimistic();
      return;
    }

    // Faster check for whether optimistic user messages have been synced to server
    const allUserMessagesSaved = optimisticMessages.every((opt) => {
      if (opt.role !== "user") return true;
      const optText = (opt.content as { text: string }).text.trim();
      return serverMessages.some((srv) => srv.role === 'user' && (srv.content as { text: string }).text.trim() === optText);
    });

    if (allUserMessagesSaved) {
      onClearOptimistic();
    }
  }, [serverMessages, optimisticMessages, activeRun, onClearOptimistic]);

  return messages;
}
