"use client";

import * as React from "react";
import type { MessageItem } from "@/modules/conversations/types";
import type { RunRecord } from "@/modules/runs/types";

export function useAgentExecutionState(
  agentId: string | null,
  activeConversationId: string | null,
) {
  const [activeRunId, setActiveRunId] = React.useState<string | null>(null);
  const [lastTerminalRun, setLastTerminalRun] =
    React.useState<RunRecord | null>(null);
  const [isOptimisticRunning, setIsOptimisticRunning] = React.useState(false);
  const [optimisticMessages, setOptimisticMessages] = React.useState<
    MessageItem[]
  >([]);
  const [executionError, setExecutionError] = React.useState<string | null>(
    null,
  );

  const dismissedRunIds = React.useRef<Set<string>>(new Set());
  const prevAgentIdRef = React.useRef(agentId);
  const prevConvIdRef = React.useRef(activeConversationId);

  // Reset state when agent or conversation changes
  React.useEffect(() => {
    const agentChanged = prevAgentIdRef.current !== agentId;
    const convChanged = prevConvIdRef.current !== activeConversationId;

    if (agentChanged) {
      prevAgentIdRef.current = agentId;
      prevConvIdRef.current = activeConversationId;
      setActiveRunId(null);
      setLastTerminalRun(null);
      setIsOptimisticRunning(false);
      setOptimisticMessages([]);
      setExecutionError(null);
      dismissedRunIds.current.clear();
      return;
    }

    if (convChanged) {
      const wasTempOrNull = !prevConvIdRef.current;
      prevConvIdRef.current = activeConversationId;

      if (wasTempOrNull && activeConversationId) {
        setOptimisticMessages((prev) =>
          prev.map((m) =>
            m.conversationId === "temp" || !m.conversationId
              ? { ...m, conversationId: activeConversationId }
              : m,
          ),
        );
      } else {
        setActiveRunId(null);
        setLastTerminalRun(null);
        setIsOptimisticRunning(false);
        setOptimisticMessages([]);
        setExecutionError(null);
      }
    }
  }, [agentId, activeConversationId]);

  return {
    activeRunId,
    setActiveRunId,
    lastTerminalRun,
    setLastTerminalRun,
    isOptimisticRunning,
    setIsOptimisticRunning,
    optimisticMessages,
    setOptimisticMessages,
    executionError,
    setExecutionError,
    dismissedRunIds,
  };
}
