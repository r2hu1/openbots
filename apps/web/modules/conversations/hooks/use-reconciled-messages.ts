import { useMemo, useEffect } from 'react';
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
  const messages = useMemo(() => {
    const result: MessageItem[] = [...serverMessages];
    const serverMsgMap = new Map<string, MessageItem>(serverMessages.map(m => [m.id, m]));

    // Handle completed run output
    if (activeRun && activeRun.status === "completed") {
      const output = activeRun.output;
      const completedOutputText =
        output && typeof output === "object" && "text" in output ? (output as any).text.trim() : null;

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

  useEffect(() => {
    if (optimisticMessages.length === 0) return;
    if (activeRun && (activeRun.status === "completed" || activeRun.status === "failed")) {
      onClearOptimistic();
      return;
    }

    const allUserMessagesSaved = optimisticMessages.every((opt) => {
      if (opt.role !== "user") return true;
      return serverMessages.some((srv) => srv.role === 'user' && (srv.content as any).text.trim() === (opt.content as any).text.trim());
    });

    if (allUserMessagesSaved) {
      onClearOptimistic();
    }
  }, [serverMessages, optimisticMessages, activeRun, onClearOptimistic]);

  return messages;
}
