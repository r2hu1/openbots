"use client";

import * as React from "react";
import type { RunStatus, StepItem } from "../types";

interface UseRunStreamOptions {
  runId: string | null;
  onDelta?: (deltaText: string, fullText: string) => void;
  onToolStart?: (step: { toolName: string; stepNumber: number }) => void;
  onToolFinish?: (step: { toolName: string; stepNumber: number }) => void;
  onStatus?: (data: {
    status: RunStatus;
    error?: string;
    output?: any;
    steps?: StepItem[];
  }) => void;
  onDone?: (data: { status: RunStatus; output?: any }) => void;
  onError?: (err: Error) => void;
}

export function useRunStream({
  runId,
  onDelta,
  onToolStart,
  onToolFinish,
  onStatus,
  onDone,
  onError,
}: UseRunStreamOptions) {
  const [streamingText, setStreamingText] = React.useState<string>("");
  const [streamingSteps, setStreamingSteps] = React.useState<StepItem[]>([]);
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [status, setStatus] = React.useState<RunStatus | null>(null);

  // Keep latest callbacks in refs to avoid reconnection loops
  const onDeltaRef = React.useRef(onDelta);
  onDeltaRef.current = onDelta;
  const onToolStartRef = React.useRef(onToolStart);
  onToolStartRef.current = onToolStart;
  const onToolFinishRef = React.useRef(onToolFinish);
  onToolFinishRef.current = onToolFinish;
  const onStatusRef = React.useRef(onStatus);
  onStatusRef.current = onStatus;
  const onDoneRef = React.useRef(onDone);
  onDoneRef.current = onDone;
  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;

  React.useEffect(() => {
    if (!runId) {
      setStreamingText("");
      setStreamingSteps([]);
      setIsStreaming(false);
      setStatus(null);
      return;
    }

    const abortController = new AbortController();
    let isTerminated = false;
    let accumulatedText = "";
    let retryCount = 0;
    const MAX_RETRIES = 4;
    let retryTimeout: any = null;
    let lastSeenSeq = -1;

    setStreamingText("");
    setStreamingSteps([]);
    setIsStreaming(true);
    setStatus("running");

    const connect = async () => {
      try {
        const apiBaseUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const url = `${apiBaseUrl}/api/runs/${runId}/stream`;

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

        if (!res.ok) {
          if (res.status === 404 && retryCount < 2) {
            // Run record might still be committing; retry briefly
            retryCount++;
            retryTimeout = setTimeout(connect, 600);
            return;
          }
          throw new Error(`Failed to connect to run stream: ${res.statusText}`);
        }

        if (!res.body) {
          throw new Error("No response body received from stream");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!abortController.signal.aborted && !isTerminated) {
          const { done, value } = await reader.read();
          if (done) break;

          // Successful data read resets retry count
          retryCount = 0;

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
              const data = JSON.parse(dataStr);

              // Deduplicate events by sequence number if present
              if (typeof data.seq === "number") {
                if (data.seq <= lastSeenSeq) continue;
                lastSeenSeq = data.seq;
              }

              if (eventType === "delta") {
                const chunk = data.text ?? "";
                if (chunk) {
                  accumulatedText += chunk;
                  setStreamingText(accumulatedText);
                  onDeltaRef.current?.(chunk, accumulatedText);
                }
              } else if (eventType === "tool_start") {
                setStreamingSteps((prev) => {
                  const existingIdx = prev.findIndex(
                    (s) => s.stepNumber === data.stepNumber,
                  );
                  const step: StepItem = {
                    stepNumber: data.stepNumber,
                    type: "tool",
                    status: "running",
                    toolName: data.toolName,
                    startedAt: new Date(),
                  };
                  if (existingIdx >= 0) {
                    const current = prev[existingIdx]!;
                    const next = [...prev];
                    next[existingIdx] = { ...current, ...step };
                    return next;
                  }
                  return [...prev, step];
                });
                onToolStartRef.current?.(data);
              } else if (eventType === "tool_finish") {
                setStreamingSteps((prev) => {
                  const existingIdx = prev.findIndex(
                    (s) => s.stepNumber === data.stepNumber,
                  );
                  if (existingIdx >= 0) {
                    const current = prev[existingIdx]!;
                    const next = [...prev];
                    next[existingIdx] = {
                      ...current,
                      status: "completed",
                      completedAt: new Date(),
                    };
                    return next;
                  }
                  return [
                    ...prev,
                    {
                      stepNumber: data.stepNumber,
                      type: "tool",
                      status: "completed",
                      toolName: data.toolName,
                      completedAt: new Date(),
                    },
                  ];
                });
                onToolFinishRef.current?.(data);
              } else if (eventType === "status") {
                const nextStatus = data.status as RunStatus;
                setStatus(nextStatus);
                if (Array.isArray(data.steps) && data.steps.length > 0) {
                  setStreamingSteps(data.steps);
                }
                if (!accumulatedText && data.output?.text) {
                  accumulatedText = data.output.text;
                  setStreamingText(accumulatedText);
                }
                onStatusRef.current?.(data);

                if (
                  nextStatus === "completed" ||
                  nextStatus === "failed" ||
                  nextStatus === "cancelled"
                ) {
                  isTerminated = true;
                  setIsStreaming(false);
                }
              } else if (eventType === "done") {
                isTerminated = true;
                setIsStreaming(false);
                setStatus((data.status as RunStatus) || "completed");
                if (!accumulatedText && data.output?.text) {
                  accumulatedText = data.output.text;
                  setStreamingText(accumulatedText);
                }
                onDoneRef.current?.(data);
              }
            } catch (jsonErr) {
              console.warn("Failed to parse SSE JSON payload:", jsonErr);
            }
          }
        }

        // Connection closed normally: if not yet terminated, attempt reconnect or verify DB
        if (!abortController.signal.aborted && !isTerminated) {
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            const delay = Math.min(800 * Math.pow(1.5, retryCount), 3000);
            retryTimeout = setTimeout(connect, delay);
            return;
          }
        }
      } catch (err: any) {
        if (
          err.name === "AbortError" ||
          abortController.signal.aborted ||
          isTerminated
        ) {
          return;
        }

        // Attempt retry on transient network errors
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = Math.min(800 * Math.pow(1.5, retryCount), 3000);
          retryTimeout = setTimeout(connect, delay);
          return;
        }

        // Retries exhausted: try one fallback fetch to verify terminal state in DB before reporting error
        try {
          const apiBaseUrl =
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
          const fallbackHeaders: Record<string, string> = {};
          if (typeof window !== "undefined") {
            const token =
              localStorage.getItem("bearer_token") ||
              localStorage.getItem("better-auth_token");
            if (token) fallbackHeaders.Authorization = `Bearer ${token}`;
          }

          const fallbackRes = await fetch(`${apiBaseUrl}/api/runs/${runId}`, {
            headers: fallbackHeaders,
            credentials: "include",
            signal: abortController.signal,
          });

          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            const run = fallbackData?.run;
            if (
              run &&
              (run.status === "completed" ||
                run.status === "failed" ||
                run.status === "cancelled")
            ) {
              isTerminated = true;
              setIsStreaming(false);
              setStatus(run.status);
              const finalText = run.output?.text || accumulatedText;
              if (finalText) {
                setStreamingText(finalText);
              }
              if (fallbackData.steps) {
                setStreamingSteps(fallbackData.steps);
              }
              onStatusRef.current?.({
                status: run.status,
                output: run.output,
                error: run.error,
              });
              onDoneRef.current?.({
                status: run.status,
                output: run.output,
              });
              return;
            }
          }
        } catch {
          // Ignore fallback error
        }

        setIsStreaming(false);
        onErrorRef.current?.(err);
      } finally {
        if (!abortController.signal.aborted && isTerminated) {
          setIsStreaming(false);
        }
      }
    };

    connect();

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      abortController.abort();
    };
  }, [runId]);

  return {
    streamingText,
    streamingSteps,
    isStreaming,
    status,
    resetStream: () => {
      setStreamingText("");
      setStreamingSteps([]);
      setIsStreaming(false);
    },
  };
}
