"use client";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import {
  useCancelRunMutation,
  useRunsQuery,
  useTriggerAgentRunMutation,
} from "@/modules/runs/queries";
import type { RunRecord } from "@/modules/runs/types";
import {
  type UseAgentExecutionOptions,
  createOptimisticMessage,
} from "./use-agent-execution-helpers";
import { useAgentExecutionState } from "./use-agent-execution-state";
import { useAgentExecutionStream } from "./use-agent-execution-stream";
import { useAgentExecutionSync } from "./use-agent-execution-sync";

export type { UseAgentExecutionOptions };

export function useAgentExecution({
  agentId,
  activeConversationId,
  onConversationCreated,
}: UseAgentExecutionOptions) {
  const queryClient = useQueryClient();

  const {
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
  } = useAgentExecutionState(agentId, activeConversationId);

  // Query runs without polling
  const { data: runs = [] } = useRunsQuery(agentId, {
    enabled: Boolean(agentId) && !activeRunId && !isOptimisticRunning,
    refetchInterval: false,
  });

  // Connect live SSE stream for the active run
  const {
    streamingText,
    streamingSteps,
    isStreaming,
    status: streamStatus,
    resetStream,
  } = useAgentExecutionStream({
    activeRunId,
    agentId,
    activeConversationId,
    queryClient,
    dismissedRunIds,
    setActiveRunId,
    setLastTerminalRun,
    setIsOptimisticRunning,
    setExecutionError,
  });

  // Sync background streams and runs
  useAgentExecutionSync({
    agentId,
    activeConversationId,
    activeRunId,
    lastTerminalRun,
    streamingText: streamingText || "",
    dismissedRunIds,
    runs,
    queryClient,
    onConversationCreated,
    setActiveRunId,
    setLastTerminalRun,
    setIsOptimisticRunning,
  });

  const activeRunStatus = streamStatus;

  // Run Mutations
  const triggerRunMutation = useTriggerAgentRunMutation(
    agentId,
    activeConversationId,
  );
  const cancelRunMutation = useCancelRunMutation(agentId);

  const clearExecutionError = React.useCallback(() => {
    setExecutionError(null);
  }, [setExecutionError]);

  const sendPrompt = React.useCallback(
    (
      prompt: string,
      images?: string[],
      attachments?: Array<{
        url: string;
        path: string;
        name: string;
        mimeType: string;
        sizeBytes?: number;
      }>,
    ) => {
      if (!agentId) return;

      resetStream();
      setIsOptimisticRunning(true);
      setLastTerminalRun(null);
      setExecutionError(null);

      const optimisticMsg = createOptimisticMessage({
        prompt,
        conversationId: activeConversationId,
        images,
        attachments,
      });
      setOptimisticMessages((prev) => [...prev, optimisticMsg]);

      triggerRunMutation.mutate(
        { prompt, images, attachments, conversationId: activeConversationId },
        {
          onSuccess: (data) => {
            if (data.run.conversationId && !activeConversationId) {
              onConversationCreated?.(data.run.conversationId);
            }
            setActiveRunId(data.run.id);
          },
          onError: (err: any) => {
            setIsOptimisticRunning(false);
            setExecutionError(
              err?.message || "Failed to start agent run. Please try again.",
            );
          },
        },
      );
    },
    [
      agentId,
      activeConversationId,
      triggerRunMutation,
      onConversationCreated,
      resetStream,
      setIsOptimisticRunning,
      setLastTerminalRun,
      setExecutionError,
      setOptimisticMessages,
      setActiveRunId,
    ],
  );

  const cancelActiveRun = React.useCallback(() => {
    resetStream();
    if (!activeRunId) {
      setIsOptimisticRunning(false);
      return;
    }
    cancelRunMutation.mutate(activeRunId, {
      onSettled: () => setIsOptimisticRunning(false),
    });
  }, [activeRunId, cancelRunMutation, resetStream, setIsOptimisticRunning]);

  const activeRun = React.useMemo(() => {
    const base = lastTerminalRun;
    if (!base && activeRunId) {
      return {
        id: activeRunId,
        userId: "",
        agentId: agentId || "",
        conversationId: activeConversationId,
        status: streamStatus || "running",
        triggerType: "manual",
        input: null,
        output: null,
        error: null,
        startedAt: new Date(),
        completedAt: null,
        createdAt: new Date(),
      } as RunRecord;
    }
    if (base && streamStatus && base.status !== streamStatus) {
      return { ...base, status: streamStatus };
    }
    return base;
  }, [lastTerminalRun, activeRunId, agentId, activeConversationId, streamStatus]);

  const activeRunSteps = streamingSteps;
  const isActiveRun =
    isOptimisticRunning ||
    isStreaming ||
    activeRunStatus === "queued" ||
    activeRunStatus === "running";

  return {
    activeRunId,
    activeRun,
    activeRunSteps,
    streamingText: streamingText || null,
    isStreaming,
    isActiveRun,
    isOptimisticRunning,
    optimisticMessages,
    setOptimisticMessages,
    lastTerminalRun,
    activeRunData: null,
    sendPrompt,
    cancelActiveRun,
    isSubmitting: triggerRunMutation.isPending,
    isCancelling: cancelRunMutation.isPending,
    executionError,
    clearExecutionError,
  };
}
