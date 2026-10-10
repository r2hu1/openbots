"use client";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import type { MessageItem } from "@/modules/conversations/types";
import {
  useCancelRunMutation,
  useRunsQuery,
  useTriggerAgentRunMutation,
} from "@/modules/runs/queries";
import { useRunStream } from "@/modules/runs/hooks/use-run-stream";
import { useAgentStream } from "./use-agent-stream";
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

  // Reset state when agent or conversation changes
  const prevAgentIdRef = React.useRef(agentId);
  const prevConvIdRef = React.useRef(activeConversationId);
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

      // If transitioning from null/new conversation to the newly assigned conversation ID,
      // migrate optimistic messages rather than discarding them so the user's prompt remains visible.
      if (wasTempOrNull && activeConversationId) {
        setOptimisticMessages((prev) =>
          prev.map((m) =>
            m.conversationId === "temp" || !m.conversationId
              ? { ...m, conversationId: activeConversationId }
              : m,
          ),
        );
      } else {
        // True conversation switch: clear state for the other conversation
        setActiveRunId(null);
        setLastTerminalRun(null);
        setIsOptimisticRunning(false);
        setOptimisticMessages([]);
        setExecutionError(null);
      }
    }
  }, [agentId, activeConversationId]);

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
          // If no conversationId is explicitly bound, attach stream to the current active chat session
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
        if (!ev.conversationId || !activeConversationId || ev.conversationId === activeConversationId) {
          setActiveRunId(ev.runId);
        }
      }
      if (ev.status === "completed" || ev.status === "failed") {
        if (ev.runId) {
          dismissedRunIds.current.add(ev.runId);
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

  // Query runs without polling (updates stream via SSE in realtime)
  const { data: runs = [] } = useRunsQuery(agentId, {
    enabled: Boolean(agentId) && !activeRunId && !isOptimisticRunning,
    refetchInterval: false,
  });

  React.useEffect(() => {
    if (!activeRunId && runs.length > 0) {
      const ongoingRun = runs.find(
        (r) =>
          !dismissedRunIds.current.has(r.id) &&
          (r.status === "running" ||
            (r.status === "queued" && r.triggerType !== "schedule")) &&
          (!activeConversationId || !r.conversationId || r.conversationId === activeConversationId),
      );
      if (ongoingRun) {
        setActiveRunId(ongoingRun.id);
      }
    }
  }, [activeRunId, runs, activeConversationId]);

  // Connect live SSE stream for the active run
  const {
    streamingText,
    streamingSteps,
    isStreaming,
    status: streamStatus,
    resetStream,
  } = useRunStream({
    runId: activeRunId,
    onStatus: (data) => {
      if (data.status === "failed") {
        setIsOptimisticRunning(false);
        if (data.error) {
          setExecutionError(data.error);
        }
        if (activeRunId) {
          setLastTerminalRun({
            id: activeRunId,
            userId: "",
            agentId: agentId || "",
            conversationId: activeConversationId,
            status: "failed",
            triggerType: "manual",
            input: null,
            output: null,
            error: data.error || "Run failed",
            startedAt: new Date(),
            completedAt: new Date(),
            createdAt: new Date(),
          });
          dismissedRunIds.current.add(activeRunId);
        }
        setActiveRunId(null);
      }
    },
    onDone: (data) => {
      setIsOptimisticRunning(false);
      const finalText = data.output?.text || streamingText;
      if (finalText && activeRunId) {
        setLastTerminalRun({
          id: activeRunId,
          userId: "",
          agentId: agentId || "",
          conversationId: activeConversationId,
          status: "completed",
          triggerType: "manual",
          input: null,
          output: { text: finalText },
          error: null,
          startedAt: new Date(),
          completedAt: new Date(),
          createdAt: new Date(),
        });
      }
      if (activeConversationId) {
        queryClient.invalidateQueries({
          queryKey: ["conversation", activeConversationId],
        });
      }
      if (agentId) {
        queryClient.invalidateQueries({
          queryKey: ["conversations", agentId],
        });
        queryClient.invalidateQueries({
          queryKey: ["runs", agentId],
        });
        queryClient.invalidateQueries({
          queryKey: ["agents"],
        });
      }
      if (activeRunId) {
        dismissedRunIds.current.add(activeRunId);
      }
      setActiveRunId(null);
    },
    onError: async (err) => {
      setIsOptimisticRunning(false);
      const currentRunId = activeRunId;

      // Double-check if the run actually succeeded in the DB before reporting an error
      if (currentRunId) {
        try {
          const apiBaseUrl =
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
          const headers: Record<string, string> = {};
          if (typeof window !== "undefined") {
            const token =
              localStorage.getItem("bearer_token") ||
              localStorage.getItem("better-auth_token");
            if (token) headers.Authorization = `Bearer ${token}`;
          }
          const res = await fetch(`${apiBaseUrl}/api/runs/${currentRunId}`, {
            headers,
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            const run = data?.run;
            if (
              run &&
              (run.status === "completed" ||
                run.status === "failed" ||
                run.status === "cancelled")
            ) {
              if (run.status === "completed") {
                setLastTerminalRun(run);
                dismissedRunIds.current.add(currentRunId);
                setActiveRunId(null);
                if (activeConversationId) {
                  queryClient.invalidateQueries({
                    queryKey: ["conversation", activeConversationId],
                  });
                }
                return;
              }
              if (run.status === "failed") {
                setExecutionError(run.error || "Run failed");
                setLastTerminalRun(run);
                dismissedRunIds.current.add(currentRunId);
                setActiveRunId(null);
                return;
              }
            }
          }
        } catch {
          // ignore verification network error
        }
      }

      const msg = err?.message || "Lost connection to stream";
      setExecutionError(msg);
      if (currentRunId) {
        dismissedRunIds.current.add(currentRunId);
      }
      setActiveRunId(null);
    },
  });

  const activeRunStatus = streamStatus;

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
      if (activeRunId && streamingText) {
        setLastTerminalRun({
          id: activeRunId,
          userId: "",
          agentId: agentId || "",
          conversationId: activeConversationId,
          status: activeRunStatus,
          triggerType: "manual",
          input: null,
          output: { text: streamingText },
          error: null,
          startedAt: new Date(),
          completedAt: new Date(),
          createdAt: new Date(),
        });
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
    activeRunId,
    activeConversationId,
    agentId,
    streamingText,
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
    (prompt: string, images?: string[]) => {
      if (!agentId) return;

      resetStream();
      setIsOptimisticRunning(true);
      setLastTerminalRun(null);
      setExecutionError(null);

      const tempId = `optimistic-${Date.now()}`;
      const optimisticMsg: MessageItem = {
        id: tempId,
        conversationId: activeConversationId || "temp",
        role: "user",
        content: {
          text: prompt,
          ...(images && images.length > 0 ? { images } : {}),
        },
        createdAt: new Date(),
      };
      setOptimisticMessages((prev) => [...prev, optimisticMsg]);

      triggerRunMutation.mutate(
        { prompt, images, conversationId: activeConversationId },
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
    resetStream();
    if (!activeRunId) {
      setIsOptimisticRunning(false);
      return;
    }
    cancelRunMutation.mutate(activeRunId, {
      onSettled: () => {
        setIsOptimisticRunning(false);
      },
    });
  }, [activeRunId, cancelRunMutation, resetStream]);

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
  }, [
    lastTerminalRun,
    activeRunId,
    agentId,
    activeConversationId,
    streamStatus,
  ]);

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
