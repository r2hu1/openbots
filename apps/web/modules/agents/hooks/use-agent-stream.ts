"use client";

import { toast } from "@openbots/ui/components/toast";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { runKeys } from "@/modules/runs/queries";
import { scheduleKeys } from "@/modules/schedules/queries";

export interface AgentStreamEvent {
  type: "run_created" | "run_status" | "schedule_fired" | "schedule_updated";
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
}

interface UseAgentStreamOptions {
  agentId: string | null;
  enabled?: boolean;
  onScheduleFired?: (event: AgentStreamEvent) => void;
  onRunCreated?: (event: AgentStreamEvent) => void;
  onRunStatus?: (event: AgentStreamEvent) => void;
}

export function useAgentStream({
  agentId,
  enabled = true,
  onScheduleFired,
  onRunCreated,
  onRunStatus,
}: UseAgentStreamOptions) {
  const queryClient = useQueryClient();

  const onScheduleFiredRef = React.useRef(onScheduleFired);
  onScheduleFiredRef.current = onScheduleFired;
  const onRunCreatedRef = React.useRef(onRunCreated);
  onRunCreatedRef.current = onRunCreated;
  const onRunStatusRef = React.useRef(onRunStatus);
  onRunStatusRef.current = onRunStatus;

  React.useEffect(() => {
    if (!agentId || !enabled) return;

    const abortController = new AbortController();

    let reconnectTimer: any = null;

    const connect = async () => {
      try {
        const apiBaseUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const url = `${apiBaseUrl}/api/agents/${agentId}/stream`;

        const headers: Record<string, string> = {
          Accept: "text/event-stream",
        };
        if (typeof window !== "undefined") {
          const token =
            localStorage.getItem("bearer_token") ||
            localStorage.getItem("better-auth_token");
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }
        }

        const res = await fetch(url, {
          method: "GET",
          headers,
          credentials: "include",
          signal: abortController.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(
            `Failed to connect to agent stream: ${res.statusText}`,
          );
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let lastSeenSeq = -1;

        while (!abortController.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          buffer = buffer.replace(/\r\n/g, "\n");
          const messages = buffer.split("\n\n");
          buffer = messages.pop() ?? "";

          for (const rawMessage of messages) {
            if (!rawMessage.trim()) continue;

            let eventType = "message";
            const dataLines: string[] = [];

            const lines = rawMessage.split("\n");
            for (const line of lines) {
              if (line.startsWith(":")) {
                // Ignore SSE comments/pings
                continue;
              }
              if (line.startsWith("event:")) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                const content = line.startsWith("data: ")
                  ? line.slice(6)
                  : line.slice(5);
                dataLines.push(content);
              }
            }

            if (dataLines.length === 0) continue;
            const dataStr = dataLines.join("\n");

            try {
              const data = JSON.parse(dataStr) as AgentStreamEvent & {
                seq?: number;
              };

              // Deduplicate events by sequence number if present
              if (typeof data.seq === "number") {
                if (data.seq <= lastSeenSeq) continue;
                lastSeenSeq = data.seq;
              }

              if (
                eventType === "schedule_fired" ||
                data.type === "schedule_fired"
              ) {
                const title = data.name
                  ? `⏰ ${data.name}`
                  : "⏰ Scheduled Task";
                const desc = data.prompt
                  ? data.prompt.slice(0, 100)
                  : "Executing scheduled task...";
                toast.add({
                  title,
                  description: desc,
                  type: "info",
                });

                // Invalidate runs, schedules, and conversation
                queryClient.invalidateQueries({
                  queryKey: runKeys.byAgent(agentId),
                });
                queryClient.invalidateQueries({
                  queryKey: scheduleKeys.byAgent(agentId),
                });
                if (data.conversationId) {
                  queryClient.invalidateQueries({
                    queryKey: ["conversation", data.conversationId],
                  });
                }

                onScheduleFiredRef.current?.(data);
              } else if (
                eventType === "run_created" ||
                data.type === "run_created"
              ) {
                queryClient.invalidateQueries({
                  queryKey: runKeys.byAgent(agentId),
                });
                onRunCreatedRef.current?.(data);
              } else if (
                eventType === "run_status" ||
                data.type === "run_status"
              ) {
                queryClient.invalidateQueries({
                  queryKey: runKeys.byAgent(agentId),
                });
                if (data.runId) {
                  queryClient.invalidateQueries({
                    queryKey: runKeys.detail(data.runId),
                  });
                }
                onRunStatusRef.current?.(data);
              } else if (
                eventType === "schedule_updated" ||
                data.type === "schedule_updated"
              ) {
                queryClient.invalidateQueries({
                  queryKey: scheduleKeys.byAgent(agentId),
                });
                queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
              }
            } catch {}
          }
        }

        // Stream completed or closed: schedule reconnect if still mounted
        if (!abortController.signal.aborted) {
          reconnectTimer = setTimeout(() => {
            if (!abortController.signal.aborted) {
              connect();
            }
          }, 1500);
        }
      } catch (err: any) {
        if (err.name === "AbortError" || abortController.signal.aborted) return;
        // Reconnect after brief backoff
        reconnectTimer = setTimeout(() => {
          if (!abortController.signal.aborted) {
            connect();
          }
        }, 3000);
      }
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      abortController.abort();
    };
  }, [agentId, enabled, queryClient]);
}
