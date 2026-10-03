"use client";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import type { MessageItem } from "@/modules/conversations/types";
import {
  useCancelRunMutation,
  useRunDetailQuery,
  useRunsQuery,
  useTriggerAgentRunMutation,
} from "@/modules/runs/queries";
import type { RunRecord } from "@/modules/runs/types";

interface UseAgentExecutionOptions {
  agentId: string | null;
  activeConversationId: string | null;
  onConversationCreated?: (id: string) => void;
}

export function useAgentExecution({
  agentId,
  activeConversationId,
  onConversationCreated,
}: UseAgentExecutionOptions) {
  const queryClient = useQueryClient();

  const [activeRunId, setActiveRunId] = React.useState<string | null>(null);
  const [lastTerminalRun, setLastTerminalRun] =
    React.useState<RunRecord | null>(null);
  const [isOptimisticRunning, setIsOptimisticRunning] = React.useState(false);
  const [optimisticMessages, setOptimisticMessages] = React.useState<
    MessageItem[]
  >([]);

  const dismissedRunIds = React.useRef<Set<string>>(new Set());

  // Reset state when agent changes
  const prevAgentIdRef = React.useRef(agentId);
  React.useEffect(() => {
    if (prevAgentIdRef.current !== agentId) {
      prevAgentIdRef.current = agentId;
      setActiveRunId(null);
      setLastTerminalRun(null);
      setIsOptimisticRunning(false);
      setOptimisticMessages([]);
      setExecutionError(null);
      dismissedRunIds.current.clear();
    }
  }, [agentId]);

  // Discover and Poll Active Run across reloads and background scheduled triggers
  const { data: runs = [] } = useRunsQuery(agentId, {
    refetchInterval: isOptimisticRunning || activeRunId ? 2000 : false,
  });

  React.useEffect(() => {
    if (!activeRunId && runs.length > 0) {
      const ongoingRun = runs.find(
        (r) =>
          !dismissedRunIds.current.has(r.id) &&
          (r.status === "running" ||
            (r.status === "queued" && r.triggerType !== "schedule")) &&
          (!activeConversationId || r.conversationId === activeConversationId),
      );
      if (ongoingRun) {
        setActiveRunId(ongoingRun.id);
      }
    }
  }, [activeRunId, runs, activeConversationId]);

  // Fetch active run details
  const { data: activeRunData } = useRunDetailQuery(activeRunId, {
    refetchInterval: (query) => {
      const status = query.state.data?.run?.status;
      return status === "queued" || status === "running" ? 800 : false;
    },
  });

  const activeRunStatus = activeRunData?.run?.status;

  // Watch for background runs completing for the current conversation and invalidate queries
  const seenCompletedRunIdsRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    if (!activeConversationId || runs.length === 0) return;
    let shouldInvalidate = false;
    for (const r of runs) {
      if (
        r.conversationId === activeConversationId &&
        (r.status === "completed" || r.status === "failed")
      ) {
        if (!seenCompletedRunIdsRef.current.has(r.id)) {
          seenCompletedRunIdsRef.current.add(r.id);
          shouldInvalidate = true;
        }
      }
    }
    if (shouldInvalidate) {
      queryClient.invalidateQueries({
        queryKey: ["conversation", activeConversationId],
      });
    }
  }, [runs, activeConversationId, queryClient]);

  // Watch active run state transitions to cleanly release UI lock
  React.useEffect(() => {
    if (
      activeRunStatus === "completed" ||
      activeRunStatus === "failed" ||
      activeRunStatus === "cancelled"
    ) {
      setIsOptimisticRunning(false);
      if (activeRunData?.run) {
        setLastTerminalRun(activeRunData.run);
      }
      if (activeRunId) {
        dismissedRunIds.current.add(activeRunId);
      }
      if (activeConversationId) {
        queryClient.invalidateQueries({
          queryKey: ["conversation", activeConversationId],
        });
      }
      if (agentId) {
        queryClient.invalidateQueries({
          queryKey: ["runs", agentId],
        });
        queryClient.invalidateQueries({
          queryKey: ["agents"],
        });
      }
      setActiveRunId(null);
    }
  }, [
    activeRunStatus,
    activeRunData?.run,
    activeRunId,
    activeConversationId,
    agentId,
    queryClient,
  ]);

  const [executionError, setExecutionError] = React.useState<string | null>(
    null,
  );

  // Run Mutations
  const triggerRunMutation = useTriggerAgentRunMutation(
    agentId,
    activeConversationId,
  );
  const cancelRunMutation = useCancelRunMutation(agentId);

  const clearExecutionError = React.useCallback(() => {
    setExecutionError(null);
  }, []);

  const sendPrompt = React.useCallback(
    (prompt: string) => {
      if (!agentId) return;

      setIsOptimisticRunning(true);
      setLastTerminalRun(null);
      setExecutionError(null);

      const tempId = `optimistic-${Date.now()}`;
      const optimisticMsg: MessageItem = {
        id: tempId,
        conversationId: activeConversationId || "temp",
        role: "user",
        content: { text: prompt },
        createdAt: new Date(),
      };
      setOptimisticMessages((prev) => [...prev, optimisticMsg]);

      triggerRunMutation.mutate(
        { prompt, conversationId: activeConversationId },
        {
          onSuccess: (data) => {
            if (data.run.conversationId && !activeConversationId) {
              onConversationCreated?.(data.run.conversationId);
            }
            setActiveRunId(data.run.id);
          },
          onError: (err: any) => {
            setIsOptimisticRunning(false);
            const errorMessage =
              err?.message || "Failed to start agent run. Please try again.";
            setExecutionError(errorMessage);
          },
        },
      );
    },
    [agentId, activeConversationId, triggerRunMutation, onConversationCreated],
  );

  const cancelActiveRun = React.useCallback(() => {
    if (!activeRunId) {
      setIsOptimisticRunning(false);
      return;
    }
    cancelRunMutation.mutate(activeRunId, {
      onSettled: () => {
        setIsOptimisticRunning(false);
      },
    });
  }, [activeRunId, cancelRunMutation]);

  const isActiveRun =
    isOptimisticRunning ||
    activeRunStatus === "queued" ||
    activeRunStatus === "running";

  return {
    activeRunId,
    activeRun: activeRunData?.run || lastTerminalRun,
    activeRunSteps: activeRunData?.steps || [],
    isActiveRun,
    isOptimisticRunning,
    optimisticMessages,
    setOptimisticMessages,
    lastTerminalRun,
    activeRunData,
    sendPrompt,
    cancelActiveRun,
    isSubmitting: triggerRunMutation.isPending,
    isCancelling: cancelRunMutation.isPending,
    executionError,
    clearExecutionError,
  };
}
