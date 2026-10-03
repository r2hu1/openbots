"use client";

import { Bubble, BubbleContent } from "@openbots/ui/components/bubble";
import {
  Marker,
  MarkerContent,
  MarkerIcon,
} from "@openbots/ui/components/marker";
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageGroup,
} from "@openbots/ui/components/message";
import { Blobatar } from "@openbots/ui/components/ui/blobatar";
import { IconAlertCircle, IconPlayerStop } from "@tabler/icons-react";
import { ExecutionStepsCard } from "@/modules/runs/components/execution-steps-card";
import type { RunRecord, StepItem } from "@/modules/runs/types";

interface ConversationLiveStatusProps {
  agentName: string;
  activeRun: RunRecord | null;
  activeRunSteps: StepItem[];
  isActiveRunOngoing: boolean;
  hasStreamingContent?: boolean;
}

export function ConversationLiveStatus({
  agentName,
  activeRun,
  activeRunSteps,
  isActiveRunOngoing,
  hasStreamingContent = false,
}: ConversationLiveStatusProps) {
  if (isActiveRunOngoing) {
    return (
      <div className="space-y-3 py-1">
        {activeRunSteps.length > 0 && (
          <ExecutionStepsCard
            steps={activeRunSteps}
            isLive={isActiveRunOngoing}
          />
        )}

        {!hasStreamingContent && (
          <MessageGroup>
            <Message align="start" className="gap-2">
              <MessageContent>
                <Bubble variant="secondary" align="start">
                  <BubbleContent className="flex items-center gap-1.5 px-3 py-2 text-foreground">
                    <span className="size-1.5 animate-bounce rounded-full bg-foreground/60 [animation-delay:-0.3s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-foreground/60 [animation-delay:-0.15s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-foreground/60" />
                  </BubbleContent>
                </Bubble>

                <MessageFooter className="gap-px px-0">
                  <Blobatar
                    name={agentName}
                    className="size-6 shrink-0"
                    blobatar={{ animate: "always" }}
                  />
                  <span className="shimmer text-xs font-medium text-foreground">
                    {agentName}
                  </span>
                </MessageFooter>
              </MessageContent>
            </Message>
          </MessageGroup>
        )}
      </div>
    );
  }

  if (
    activeRun &&
    (activeRun.status === "failed" || activeRun.status === "cancelled")
  ) {
    return (
      <div className="py-1">
        {activeRun.status === "failed" && activeRun.error && (
          <Marker className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            <MarkerIcon>
              <IconAlertCircle className="size-4 shrink-0 text-destructive" />
            </MarkerIcon>
            <MarkerContent className="font-mono text-[11px] leading-relaxed">
              {activeRun.error}
            </MarkerContent>
          </Marker>
        )}

        {activeRun.status === "cancelled" && (
          <Marker className="text-xs text-muted-foreground">
            <MarkerIcon>
              <IconPlayerStop className="size-3.5" />
            </MarkerIcon>
            <MarkerContent>The run was halted safely.</MarkerContent>
          </Marker>
        )}
      </div>
    );
  }

  return null;
}
