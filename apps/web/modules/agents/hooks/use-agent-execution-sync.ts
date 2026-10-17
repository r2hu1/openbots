"use client";

import type { QueryClient } from "@tanstack/react-query";
import * as React from "react";
import type { RunRecord } from "@/modules/runs/types";
import { useAgentStream } from "./use-agent-stream";
import { createTerminalRunRecord } from "./use-agent-execution-helpers";

interface UseAgentExecutionSyncOptions {
  agentId: string | null;
  activeConversationId: string | null;
  activeRunId: string | null;
  activeRunStatus: string | null;
  lastTerminalRun: RunRecord | null;
  streamingText: string;
  dismissedRunIds: React.MutableRefObject<Set<string>>;
  runs: RunRecord[];
  queryClient: QueryClient;
  resetStream: () => void;
  onConversationCreated?: (id: string) => void;
  setActiveRunId: (id: string | null) => void;
  setLastTerminalRun: (run: RunRecord | null) => void;
  setIsOptimisticRunning: (running: boolean) => void;
}

export function useAgentExecutionSync({
  agentId,
  activeConversationId,
  activeRunId,
  activeRunStatus,
  lastTerminalRun,
  streamingText,
  dismissedRunIds,
  runs,
  queryClient,
  resetStream,
  onConversationCreated,
  setActiveRunId,
  setLastTerminalRun,
  setIsOptimisticRunning,
}: UseAgentExecutionSyncOptions) {
  // Listen to realtime agent events (schedules firing, runs created, runs status)
  useAgentStream({
    agentId,
    onScheduleFired: (ev) => {
      if (ev.runId) {
        if (ev.conversationId) {
          if (!activeConversationId) {
            onConversationCreated?.(ev.conversationId);
            setActiveRunId(ev.runId);
          } else if (activeConversationId === ev.conversationId) {
            setActiveRunId(ev.runId);
          }
        } else {
          setActiveRunId(ev.runId);
        }
      }
    },
    onRunStatus: (ev) => {
      if (
        ev.runId &&
        ev.status === "running" &&
        !activeRunId &&
        !dismissedRunIds.current.has(ev.runId)
      ) {
        if (
          !ev.conversationId ||
          !activeConversationId ||
          ev.conversationId === activeConversationId
        ) {
          setActiveRunId(ev.runId);
        }
      }
      if (ev.status === "completed" || ev.status === "failed") {
        if (ev.runId) {
          dismissedRunIds.current.add(ev.runId);
        }
        if (ev.runId && (activeRunId === ev.runId || !lastTerminalRun)) {
          const runOutput =
            ev.output || (streamingText ? { text: streamingText } : null);
          setLastTerminalRun(
            createTerminalRunRecord({
              id: ev.runId,
              agentId,
              conversationId: ev.conversationId || activeConversationId,
              status: ev.status,
              output: runOutput,
              error: ev.error,
            }),
          );
        }
        if (activeConversationId) {
          queryClient.invalidateQueries({
            queryKey: ["conversation", activeConversationId],
          });
        }
        if (ev.conversationId && ev.conversationId !== activeConversationId) {
          queryClient.invalidateQueries({
            queryKey: ["conversation", ev.conversationId],
          });
        }
        if (agentId) {
          queryClient.invalidateQueries({
            queryKey: ["conversations", agentId],
          });
        }
        if (activeRunId === ev.runId) {
          setActiveRunId(null);
          setIsOptimisticRunning(false);
        }
      }
    },
  });

  // Watch active run state transitions to cleanly release UI lock
  React.useEffect(() => {
    if (
      activeRunStatus === "completed" ||
      activeRunStatus === "failed" ||
      activeRunStatus === "cancelled"
    ) {
      setIsOptimisticRunning(false);
      if (activeRunId && streamingText) {
        setLastTerminalRun(
          createTerminalRunRecord({
            id: activeRunId,
            agentId,
            conversationId: activeConversationId,
            status: activeRunStatus,
            output: { text: streamingText },
          }),
        );
      }
      if (activeRunId) dismissedRunIds.current.add(activeRunId);
      resetStream();
      if (activeConversationId) {
        queryClient.invalidateQueries({
          queryKey: ["conversation", activeConversationId],
        });
      }
      if (agentId) {
        queryClient.invalidateQueries({ queryKey: ["runs", agentId] });
        queryClient.invalidateQueries({ queryKey: ["agents"] });
      }
      setActiveRunId(null);
    }
  }, [
    activeRunStatus,
    activeRunId,
    activeConversationId,
    agentId,
    streamingText,
    queryClient,
    resetStream,
    dismissedRunIds,
    setActiveRunId,
    setIsOptimisticRunning,
    setLastTerminalRun,
  ]);

  // Watch for background runs completing for the current conversation
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

  // Pick up ongoing active run from runs list
  React.useEffect(() => {
    if (!activeRunId && runs.length > 0) {
      const ongoingRun = runs.find(
        (r) =>
          !dismissedRunIds.current.has(r.id) &&
          (r.status === "running" ||
            (r.status === "queued" && r.triggerType !== "schedule")) &&
          (!activeConversationId ||
            !r.conversationId ||
            r.conversationId === activeConversationId),
      );
      if (ongoingRun) {
        setActiveRunId(ongoingRun.id);
      }
    }
  }, [activeRunId, runs, activeConversationId, dismissedRunIds, setActiveRunId]);
}
