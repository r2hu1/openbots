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
      dismissedRunIds.current.clear();
    }
  }, [agentId]);

  // Discover and Poll Active Run across reloads
  const { data: runs = [] } = useRunsQuery(agentId, {
    refetchInterval: isOptimisticRunning || activeRunId ? 3000 : false,
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
      return status === "queued" || status === "running" ? 1500 : false;
    },
  });

  const activeRunStatus = activeRunData?.run?.status;

  // SSE Live Streaming for real-time text tokens and instant response
  React.useEffect(() => {
    if (!activeRunId) return;

    let isMounted = true;
    const eventSource = new EventSource(`/api/runs/${activeRunId}/stream`, {
      withCredentials: true,
    });

    eventSource.addEventListener("delta", (e) => {
      if (!isMounted) return;
      try {
        const data = JSON.parse(e.data);
        if (data.text) {
          const assistantOptId = `opt-streaming-${activeRunId}`;
          setOptimisticMessages((prev) => {
            const existingIndex = prev.findIndex((m) => m.id === assistantOptId);
            if (existingIndex >= 0) {
              const updated = [...prev];
              const currentContent =
                typeof updated[existingIndex]?.content === "object" &&
                updated[existingIndex]?.content &&
                "text" in (updated[existingIndex]!.content as any)
                  ? (updated[existingIndex]!.content as any).text
                  : String(updated[existingIndex]?.content ?? "");
              updated[existingIndex] = {
                ...updated[existingIndex]!,
                content: { text: currentContent + data.text },
              };
              return updated;
            } else {
              return [
                ...prev,
                {
                  id: assistantOptId,
                  conversationId: activeConversationId || "temp",
                  role: "assistant",
                  content: { text: data.text },
                  createdAt: new Date(),
                },
              ];
            }
          });
        }
      } catch (err) {
        console.warn("Error parsing stream delta:", err);
      }
    });

    const handleTerminalState = (status: string) => {
      setIsOptimisticRunning(false);
      if (activeConversationId) {
        queryClient.invalidateQueries({
          queryKey: ["conversation", activeConversationId],
        });
      }
      if (agentId) {
        queryClient.invalidateQueries({
          queryKey: ["runs", agentId],
        });
      }
      if (activeRunId) {
        queryClient.invalidateQueries({
          queryKey: ["run", activeRunId],
        });
      }
      eventSource.close();
    };

    eventSource.addEventListener("status", (e) => {
      if (!isMounted) return;
      try {
        const data = JSON.parse(e.data);
        if (
          data.status === "completed" ||
          data.status === "failed" ||
          data.status === "cancelled"
        ) {
          handleTerminalState(data.status);
        }
      } catch (err) {
        console.warn("Error parsing status event:", err);
      }
    });

    eventSource.addEventListener("done", () => {
      if (!isMounted) return;
      handleTerminalState("completed");
    });

    eventSource.onerror = () => {
      // EventSource will auto-reconnect or fall back gracefully to useRunDetailQuery polling
    };

    return () => {
      isMounted = false;
      eventSource.close();
    };
  }, [activeRunId, activeConversationId]);

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

  // Run Mutations
  const triggerRunMutation = useTriggerAgentRunMutation(
    agentId,
    activeConversationId,
  );
  const cancelRunMutation = useCancelRunMutation(agentId);

  const sendPrompt = React.useCallback(
    (prompt: string) => {
      if (!agentId) return;

      setIsOptimisticRunning(true);
      setLastTerminalRun(null);

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
          onError: () => {
            setIsOptimisticRunning(false);
            setOptimisticMessages((prev) =>
              prev.filter((m) => m.id !== tempId),
            );
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
  };
}
