"use client";

import type { QueryClient } from "@tanstack/react-query";
import type * as React from "react";
import { useRunStream } from "@/modules/runs/hooks/use-run-stream";
import type { RunRecord } from "@/modules/runs/types";
import {
  createTerminalRunRecord,
  verifyRunTerminalState,
} from "./use-agent-execution-helpers";

interface UseAgentExecutionStreamOptions {
  activeRunId: string | null;
  agentId: string | null;
  activeConversationId: string | null;
  queryClient: QueryClient;
  dismissedRunIds: React.MutableRefObject<Set<string>>;
  setActiveRunId: (id: string | null) => void;
  setLastTerminalRun: (run: RunRecord | null) => void;
  setIsOptimisticRunning: (running: boolean) => void;
  setExecutionError: (err: string | null) => void;
}

export function useAgentExecutionStream({
  activeRunId,
  agentId,
  activeConversationId,
  queryClient,
  dismissedRunIds,
  setActiveRunId,
  setLastTerminalRun,
  setIsOptimisticRunning,
  setExecutionError,
}: UseAgentExecutionStreamOptions) {
  return useRunStream({
    runId: activeRunId,
    onStatus: (data) => {
      if (data.status === "failed") {
        setIsOptimisticRunning(false);
        if (data.error) setExecutionError(data.error);
        if (activeRunId) {
          setLastTerminalRun(
            createTerminalRunRecord({
              id: activeRunId,
              agentId,
              conversationId: activeConversationId,
              status: "failed",
              error: data.error || "Run failed",
            }),
          );
          dismissedRunIds.current.add(activeRunId);
        }
        setActiveRunId(null);
      }
    },
    onDone: (data) => {
      setIsOptimisticRunning(false);
      const finalText = data.output?.text;
      if (finalText && activeRunId) {
        setLastTerminalRun(
          createTerminalRunRecord({
            id: activeRunId,
            agentId,
            conversationId: activeConversationId,
            status: "completed",
            output: { text: finalText },
          }),
        );
      }
      if (activeConversationId) {
        queryClient.invalidateQueries({
          queryKey: ["conversation", activeConversationId],
        });
      }
      if (agentId) {
        queryClient.invalidateQueries({ queryKey: ["conversations", agentId] });
        queryClient.invalidateQueries({ queryKey: ["runs", agentId] });
        queryClient.invalidateQueries({ queryKey: ["agents"] });
      }
      if (activeRunId) dismissedRunIds.current.add(activeRunId);
      setActiveRunId(null);
    },
    onError: async (err) => {
      setIsOptimisticRunning(false);
      const currentRunId = activeRunId;
      if (currentRunId) {
        const verifiedRun = await verifyRunTerminalState(currentRunId);
        if (verifiedRun) {
          setLastTerminalRun(verifiedRun);
          dismissedRunIds.current.add(currentRunId);
          setActiveRunId(null);
          if (verifiedRun.status === "failed") {
            setExecutionError(verifiedRun.error || "Run failed");
          } else if (activeConversationId) {
            queryClient.invalidateQueries({
              queryKey: ["conversation", activeConversationId],
            });
          }
          return;
        }
      }
      setExecutionError(err?.message || "Lost connection to stream");
      if (currentRunId) dismissedRunIds.current.add(currentRunId);
      setActiveRunId(null);
    },
  });
}
