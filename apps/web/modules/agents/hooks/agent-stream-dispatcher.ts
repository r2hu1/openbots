"use client";

import { toast } from "@openbots/ui/components/toast";
import type { QueryClient } from "@tanstack/react-query";
import { runKeys } from "@/modules/runs/queries";
import { scheduleKeys } from "@/modules/schedules/queries";

export interface AgentStreamEvent {
  type:
    | "run_created"
    | "run_status"
    | "schedule_fired"
    | "schedule_updated"
    | "schedules_init";
  run?: any;
  runId?: string;
  status?: string;
  error?: string;
  output?: any;
  scheduleId?: string;
  action?: "created" | "updated" | "deleted";
  name?: string;
  prompt?: string;
  conversationId?: string | null;
  schedules?: any[];
  seq?: number;
}

export interface StreamDispatcherContext {
  agentId: string;
  queryClient: QueryClient;
  onScheduleFired?: (event: AgentStreamEvent) => void;
  onRunCreated?: (event: AgentStreamEvent) => void;
  onRunStatus?: (event: AgentStreamEvent) => void;
}

export function handleAgentStreamEvent(
  eventType: string,
  data: AgentStreamEvent,
  ctx: StreamDispatcherContext
) {
  const { agentId, queryClient, onScheduleFired, onRunCreated, onRunStatus } =
    ctx;

  if (eventType === "schedule_fired" || data.type === "schedule_fired") {
    const title = data.name ? `⏰ ${data.name}` : "⏰ Scheduled Task";
    const desc = data.prompt
      ? data.prompt.slice(0, 100)
      : "Executing scheduled task...";
    toast.add({
      title,
      description: desc,
      type: "info",
    });

    // Invalidate runs, schedules, and conversations
    queryClient.invalidateQueries({
      queryKey: runKeys.byAgent(agentId),
    });
    queryClient.invalidateQueries({
      queryKey: scheduleKeys.byAgent(agentId),
    });
    queryClient.invalidateQueries({
      queryKey: ["conversations", agentId],
    });
    if (data.conversationId) {
      queryClient.invalidateQueries({
        queryKey: ["conversation", data.conversationId],
      });
    } else {
      queryClient.invalidateQueries({
        queryKey: ["conversation"],
      });
    }

    onScheduleFired?.(data);
  } else if (eventType === "run_created" || data.type === "run_created") {
    onRunCreated?.(data);
  } else if (eventType === "schedules_init" || data.type === "schedules_init") {
    if (Array.isArray(data.schedules)) {
      queryClient.setQueryData(scheduleKeys.byAgent(agentId), data.schedules);
    }
  } else if (eventType === "run_status" || data.type === "run_status") {
    const status = data.status || data.run?.status;
    const isTerminal =
      status === "completed" || status === "failed" || status === "cancelled";
    if (isTerminal) {
      queryClient.invalidateQueries({
        queryKey: runKeys.byAgent(agentId),
      });
      if (data.runId) {
        queryClient.invalidateQueries({
          queryKey: runKeys.detail(data.runId),
        });
      }
      queryClient.invalidateQueries({
        queryKey: ["conversations", agentId],
      });
      if (data.conversationId) {
        queryClient.invalidateQueries({
          queryKey: ["conversation", data.conversationId],
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: ["conversation"],
        });
      }
    }
    onRunStatus?.(data);
  } else if (
    eventType === "schedule_updated" ||
    data.type === "schedule_updated"
  ) {
    queryClient.invalidateQueries({
      queryKey: scheduleKeys.byAgent(agentId),
    });
    queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    queryClient.invalidateQueries({
      queryKey: runKeys.byAgent(agentId),
    });
  }
}
