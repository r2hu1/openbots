"use client"

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@openbots/ui/components/message-scroller"
import { Spinner } from "@openbots/ui/components/spinner"
import * as React from "react"
import type { ParsedArtifact } from "@/modules/artifacts/parser"
import type { RunRecord, StepItem } from "@/modules/runs/types"
import { useConversationScroll } from "../hooks/use-conversation-scroll"
import type { MessageItem, ReplyTarget } from "../types"
import { ConversationLiveStatus } from "./conversation-live-status"
import { ConversationMessageItem } from "./conversation-message-item"
import { ConversationTimelineEmpty } from "./conversation-timeline-empty"
import { ConversationTimelineError } from "./conversation-timeline-error"
import { ConversationTimelineLoadOlder } from "./conversation-timeline-load-older"
import { StreamingAssistantMessage } from "./streaming-assistant-message"
import { ChevronDown } from "reicon-react"
import { cn } from "@/lib/utils"

interface ConversationTimelineProps {
  messages: MessageItem[]
  activeRun: RunRecord | null
  activeRunSteps: StepItem[]
  onCancelRun?: () => void
  isCancelling?: boolean
  agentName: string
  isOptimisticRunning?: boolean
  isLoading?: boolean
  onOpenArtifact?: (artifact: ParsedArtifact) => void
  hasOlderMessages?: boolean
  isLoadingOlder?: boolean
  onLoadOlderMessages?: () => void
  executionError?: string | null
  onDismissError?: () => void
  onReply?: (target: ReplyTarget) => void
  onReact?: (messageId: string, emoji: string) => void
  streamingText?: string | null
}

export function ConversationTimeline({
  messages,
  activeRun,
  activeRunSteps,
  agentName,
  isOptimisticRunning = false,
  isLoading = false,
  onOpenArtifact,
  hasOlderMessages = false,
  isLoadingOlder = false,
  onLoadOlderMessages,
  executionError,
  onDismissError,
  onReply,
  onReact,
  streamingText,
}: ConversationTimelineProps) {
  // Check if this specific active run's output is already rendered in messages
  const isCurrentRunAlreadyRendered = React.useMemo(() => {
    if (!activeRun || !messages || messages.length === 0) return false
    const outputText =
      activeRun.output &&
      typeof activeRun.output === "object" &&
      "text" in activeRun.output &&
      typeof (activeRun.output as { text: unknown }).text === "string"
        ? (activeRun.output as { text: string }).text.trim()
        : null

    return messages.some((m) => {
      if (m.role !== "assistant") return false
      if (
        activeRun.id &&
        (m.id === `run-asst-${activeRun.id}` ||
          m.id === `opt-assistant-${activeRun.id}` ||
          m.id.includes(activeRun.id))
      ) {
        return true
      }
      if (outputText) {
        const text =
          typeof m.content === "string"
            ? m.content
            : (m.content as any)?.text || ""
        if (text.trim() === outputText) return true
      }
      return false
    })
  }, [messages, activeRun])

  const isActiveRunOngoing =
    isOptimisticRunning ||
    activeRun?.status === "queued" ||
    activeRun?.status === "running"

  const { topSentinelRef, viewportRef, handleScroll } = useConversationScroll({
    messages,
    isLoading,
    hasOlderMessages,
    isLoadingOlder,
    onLoadOlderMessages,
  })

  return (
    <MessageScrollerProvider defaultScrollPosition="end" autoScroll>
      <MessageScroller className="flex-1">
        <MessageScrollerViewport
          ref={viewportRef}
          onScroll={handleScroll}
          className="border-none outline-none"
        >
          <MessageScrollerContent className="mx-auto max-w-4xl space-y-6 px-4 py-6">
            <div
              ref={topSentinelRef}
              className="pointer-events-none h-1 w-full"
            />

            <ConversationTimelineLoadOlder
              hasOlderMessages={hasOlderMessages}
              isLoadingOlder={isLoadingOlder}
              onLoadOlderMessages={onLoadOlderMessages}
            />

            {isLoading ? (
              <div className="space-y-6 py-30">
                <Spinner className="mx-auto size-6" />
              </div>
            ) : messages.length === 0 && !activeRun && !executionError ? (
              <ConversationTimelineEmpty agentName={agentName} />
            ) : null}

            {!isLoading &&
              messages.map((msg) => (
                <MessageScrollerItem
                  key={msg.id}
                  id={`message-${msg.id}`}
                  data-message-id={msg.id}
                  messageId={msg.id}
                >
                  <ConversationMessageItem
                    message={msg}
                    agentName={agentName}
                    onOpenArtifact={onOpenArtifact}
                    onReply={onReply}
                    onReact={onReact}
                  />
                </MessageScrollerItem>
              ))}

            {/* Assistant message: streaming text if available */}
            {!isLoading &&
            isActiveRunOngoing &&
            !isCurrentRunAlreadyRendered &&
            streamingText &&
            streamingText.trim() ? (
              <StreamingAssistantMessage
                activeRunId={activeRun?.id}
                conversationId={activeRun?.conversationId}
                streamingText={streamingText}
                agentName={agentName}
                onOpenArtifact={onOpenArtifact}
              />
            ) : null}

            {/* Live tool execution steps and thinking indicator when no text streamed yet */}
            {!isLoading &&
            isActiveRunOngoing &&
            !isCurrentRunAlreadyRendered &&
            (!streamingText || !streamingText.trim()) ? (
              <MessageScrollerItem
                key={`live-status-${activeRun?.id || "current"}`}
                id={`live-status-${activeRun?.id || "current"}`}
              >
                <ConversationLiveStatus
                  agentName={agentName}
                  activeRun={activeRun}
                  activeRunSteps={activeRunSteps}
                  isActiveRunOngoing={true}
                  hasStreamingContent={false}
                />
              </MessageScrollerItem>
            ) : null}

            {/* Live tool execution steps and thinking indicator after text is already streamed */}
            {!isLoading &&
            isActiveRunOngoing &&
            streamingText &&
            streamingText.trim() ? (
              <MessageScrollerItem key="live-steps">
                <ConversationLiveStatus
                  agentName={agentName}
                  activeRun={activeRun}
                  activeRunSteps={activeRunSteps}
                  isActiveRunOngoing={true}
                  hasStreamingContent={true}
                />
              </MessageScrollerItem>
            ) : null}

            {/* Terminal failure or cancellation marker */}
            {!isActiveRunOngoing &&
              activeRun &&
              (activeRun.status === "failed" ||
                activeRun.status === "cancelled") && (
                <MessageScrollerItem key={`terminal-${activeRun.id}`}>
                  <ConversationLiveStatus
                    agentName={agentName}
                    activeRun={activeRun}
                    activeRunSteps={[]}
                    isActiveRunOngoing={false}
                    hasStreamingContent={true}
                  />
                </MessageScrollerItem>
              )}

            {executionError && !activeRun?.error && (
              <MessageScrollerItem key="execution-error">
                <ConversationTimelineError
                  error={executionError}
                  onDismiss={onDismissError}
                />
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton
          variant={activeRun?.status === "running" ? "default" : "outline"}
        >
          {activeRun?.status === "running" ? (
            <div className="flex items-center gap-0.5 py-0">
              <div className="animate-bounce-pulse size-1 rounded-full bg-primary-foreground delay-75" />
              <div className="animate-bounce-pulse size-1 rounded-full bg-primary-foreground delay-150" />
              <div className="animate-bounce-pulse size-1 rounded-full bg-primary-foreground delay-200" />
            </div>
          ) : (
            <ChevronDown />
          )}
        </MessageScrollerButton>
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
