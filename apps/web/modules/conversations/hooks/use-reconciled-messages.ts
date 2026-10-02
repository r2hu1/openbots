"use client";

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
    let result = [...serverMessages];

    // If an active or recently completed run has output.text, ensure it is immediately visible
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
          const t =
            typeof m.content === "object" && m.content && "text" in m.content
              ? (m.content as { text: string }).text
              : String(m.content);
          return t.trim() === completedOutputText;
        });

        if (!hasResponseAlready) {
          result.push({
            id: `opt-assistant-${activeRun.id}`,
            conversationId: activeConversationId || "temp",
            role: "assistant",
            content: { text: completedOutputText },
            createdAt: activeRun.completedAt || new Date(),
          });
        }
      }
    }

    if (optimisticMessages.length > 0) {
      const reconciledOptimistic = optimisticMessages.filter((opt) => {
        const optText =
          typeof opt.content === "object" &&
          opt.content &&
          "text" in opt.content
            ? (opt.content as { text: string }).text
            : String(opt.content);

        // If it's a streaming assistant message, do not duplicate if the final message has arrived in serverMessages
        if (opt.role === "assistant") {
          return !result.some((srv) => {
            if (srv.role !== "assistant") return false;
            const srvText =
              typeof srv.content === "object" &&
              srv.content &&
              "text" in srv.content
                ? (srv.content as { text: string }).text
                : String(srv.content);
            return srvText.trim() === optText.trim();
          });
        }

        // For user messages, ensure not already persisted in serverMessages
        return !result.some((srv) => {
          const srvText =
            typeof srv.content === "object" &&
            srv.content &&
            "text" in srv.content
              ? (srv.content as { text: string }).text
              : String(srv.content);
          return srv.role === "user" && srvText === optText;
        });
      });
      result = [...result, ...reconciledOptimistic];
    }

    return result;
  }, [serverMessages, optimisticMessages, activeRun, activeConversationId]);

  // Clear optimistic messages once server messages catch up
  React.useEffect(() => {
    if (serverMessages.length > 0 && optimisticMessages.length > 0) {
      const allReconciled = optimisticMessages.every((opt) => {
        const optText =
          typeof opt.content === "object" &&
          opt.content &&
          "text" in opt.content
            ? (opt.content as { text: string }).text
            : String(opt.content);

        return serverMessages.some((srv) => {
          const srvText =
            typeof srv.content === "object" &&
            srv.content &&
            "text" in srv.content
              ? (srv.content as { text: string }).text
              : String(srv.content);
          return srv.role === opt.role && (srvText === optText || srvText.trim() === optText.trim());
        });
      });
      if (allReconciled) {
        onClearOptimistic();
      }
    }
  }, [serverMessages, optimisticMessages, onClearOptimistic]);

  return messages;
}
