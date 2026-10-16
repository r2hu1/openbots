"use client";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { runKeys } from "../queries";
import type { RunRecord } from "../types";

export interface RunsStreamEvent {
  type: "run_created" | "run_status" | "ping" | "ready";
  run?: RunRecord;
  runId?: string;
  status?: string;
  error?: string;
  output?: any;
  conversationId?: string | null;
  seq?: number;
}

interface UseRunsStreamOptions {
  agentId?: string | null;
  enabled?: boolean;
  onRunCreated?: (run: RunRecord) => void;
  onRunStatus?: (event: RunsStreamEvent) => void;
}

/**
 * Connects to the dedicated runs SSE stream (`/api/runs/stream?agentId=...`)
 * to receive real-time execution lifecycle events (created, running, completed, cancelled, failed).
 * Automatically updates TanStack Query caches without jitter.
 */
export function useRunsStream({
  agentId,
  enabled = true,
  onRunCreated,
  onRunStatus,
}: UseRunsStreamOptions) {
  const queryClient = useQueryClient();

  const onRunCreatedRef = React.useRef(onRunCreated);
  onRunCreatedRef.current = onRunCreated;
  const onRunStatusRef = React.useRef(onRunStatus);
  onRunStatusRef.current = onRunStatus;

  React.useEffect(() => {
    if (!enabled) return;

    const abortController = new AbortController();
    let reconnectTimer: any = null;

    const connect = async () => {
      try {
        const apiBaseUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const queryParam = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
        const url = `${apiBaseUrl}/api/runs/stream${queryParam}`;

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
          throw new Error(`Failed to connect to runs stream: ${res.statusText}`);
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
              const data = JSON.parse(dataStr) as RunsStreamEvent;

              // Deduplicate events by sequence number if present
              if (typeof data.seq === "number") {
                if (data.seq <= lastSeenSeq) continue;
                lastSeenSeq = data.seq;
              }

              if (eventType === "run_created" || data.type === "run_created") {
                // Optimistically prepend newly created run to query cache
                if (data.run) {
                  queryClient.setQueryData<RunRecord[]>(
                    runKeys.byAgent(agentId),
                    (prev) => {
                      if (!prev) return [data.run!];
                      if (prev.some((r) => r.id === data.run!.id)) return prev;
                      return [data.run!, ...prev];
                    }
                  );
                }

                // Invalidate runs query to ensure complete synchronization
                queryClient.invalidateQueries({
                  queryKey: runKeys.byAgent(agentId),
                });

                onRunCreatedRef.current?.(data.run!);
              } else if (
                eventType === "run_status" ||
                data.type === "run_status"
              ) {
                const effectiveRunId = data.runId || data.run?.id;
                const nextStatus = data.status || data.run?.status;

                // Update run status in the runs list cache immediately
                if (effectiveRunId && nextStatus) {
                  queryClient.setQueryData<RunRecord[]>(
                    runKeys.byAgent(agentId),
                    (prev) => {
                      if (!prev) return prev;
                      return prev.map((r) =>
                        r.id === effectiveRunId
                          ? {
                              ...r,
                              status: nextStatus as RunRecord["status"],
                              output: data.output ?? r.output,
                              error: data.error ?? r.error,
                              completedAt:
                                nextStatus === "completed" ||
                                nextStatus === "failed" ||
                                nextStatus === "cancelled"
                                  ? new Date()
                                  : r.completedAt,
                            }
                          : r
                      );
                    }
                  );
                }

                // Always invalidate run detail query when active or terminal
                if (effectiveRunId) {
                  queryClient.invalidateQueries({
                    queryKey: runKeys.detail(effectiveRunId),
                  });
                }

                const isTerminal =
                  nextStatus === "completed" ||
                  nextStatus === "failed" ||
                  nextStatus === "cancelled";

                if (isTerminal) {
                  queryClient.invalidateQueries({
                    queryKey: runKeys.byAgent(agentId),
                  });
                }

                onRunStatusRef.current?.(data);
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
