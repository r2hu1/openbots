"use client"

import { Bubble, BubbleContent } from "@openbots/ui/components/bubble"
import {
  Marker,
  MarkerContent,
  MarkerIcon,
} from "@openbots/ui/components/marker"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
} from "@openbots/ui/components/message"
import { Spinner } from "@openbots/ui/components/spinner"
import { Blobatar } from "@openbots/ui/components/ui/blobatar"
import { IconAlertCircle, IconCheck, IconPlayerStop } from "@tabler/icons-react"
import { formatToolStepLabel } from "@/modules/runs/tool-label"
import type { RunRecord, StepItem } from "@/modules/runs/types"

interface ConversationLiveStatusProps {
  agentName: string
  activeRun: RunRecord | null
  activeRunSteps: StepItem[]
  isActiveRunOngoing: boolean
  hasStreamingContent?: boolean
}

export function ConversationLiveStatus({
  agentName,
  activeRun,
  activeRunSteps,
  isActiveRunOngoing,
  hasStreamingContent = false,
}: ConversationLiveStatusProps) {
  if (isActiveRunOngoing) {
    if (activeRunSteps.length === 0 && hasStreamingContent) {
      return null
    }

    // Find the latest active or completed tool step to display minimally
    const latestToolStep = [...activeRunSteps]
      .reverse()
      .find((s) => s.type === "tool" || Boolean(s.toolName))

    const latestToolLabel = latestToolStep
      ? formatToolStepLabel(
          latestToolStep.toolName,
          latestToolStep.status,
          latestToolStep.toolInput,
          latestToolStep.toolOutput
        ).label
      : null

    const isLatestToolRunning = latestToolStep?.status === "running"

    return (
      <div className="space-y-3 py-1">
        {!hasStreamingContent && (
          <MessageGroup>
            <Message align="start" className="gap-2">
              <MessageAvatar className="-mr-1 p-0!">
                <Blobatar
                  name={agentName}
                  className="size-8!"
                  blobatar={{ animate: "always" }}
                />
              </MessageAvatar>
              <MessageContent>
                <Bubble variant="secondary" align="start">
                  <BubbleContent className="flex items-center gap-1.5 text-foreground">
                    <span className="size-1.5 animate-bounce rounded-full bg-foreground/60 [animation-delay:-0.3s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-foreground/60 [animation-delay:-0.15s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-foreground/60" />
                  </BubbleContent>
                </Bubble>
              </MessageContent>
            </Message>
            <div className="gap-px px-0">
              <Marker className="text-xs text-muted-foreground">
                {latestToolLabel ? (
                  <>
                    <MarkerIcon className="size-3.5 shrink-0">
                      {isLatestToolRunning ? (
                        <Spinner className="size-3 text-primary" />
                      ) : (
                        <IconCheck className="size-3" />
                      )}
                    </MarkerIcon>
                    <MarkerContent
                      className={
                        isLatestToolRunning
                          ? "shimmer font-medium"
                          : "truncate text-muted-foreground"
                      }
                    >
                      {latestToolLabel}
                    </MarkerContent>
                  </>
                ) : (
                  <MarkerContent className="shimmer text-xs">
                    Thinking...
                  </MarkerContent>
                )}
              </Marker>
            </div>
          </MessageGroup>
        )}
      </div>
    )
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
    )
  }

  return null
}
