"use client"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@openbots/ui/components/alert"
import { Badge } from "@openbots/ui/components/badge"
import { Bubble, BubbleContent } from "@openbots/ui/components/bubble"
import { Button } from "@openbots/ui/components/button"
import { Blobatar } from "@openbots/ui/components/ui/blobatar"
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
  MessageHeader,
} from "@openbots/ui/components/message"

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@openbots/ui/components/message-scroller"

import { Skeleton } from "@openbots/ui/components/skeleton"
import { Spinner } from "@openbots/ui/components/spinner"
import {
  IconAlertCircle,
  IconCheck,
  IconClock,
  IconPlayerStop,
  IconRobot,
  IconUser,
  IconX,
} from "@tabler/icons-react"
import { ExecutionStepsCard, type StepItem } from "./execution-steps-card"
import type { RunRecord } from "./run-history-sheet"
import { Markdown } from "./markdown"

export type MessageItem = {
  id: string
  conversationId: string
  role: "system" | "user" | "assistant" | "tool"
  content: unknown
  createdAt: string | Date
}

interface ConversationTimelineProps {
  messages: MessageItem[]
  activeRun: RunRecord | null
  activeRunSteps: StepItem[]
  onCancelRun?: () => void
  isCancelling?: boolean
  agentName: string
  isOptimisticRunning?: boolean
  isLoading?: boolean
}

function getMessageText(content: unknown): string {
  if (content === null || content === undefined) return ""
  if (typeof content === "string") return content
  if (typeof content === "object") {
    const obj = content as Record<string, unknown>
    if (typeof obj.text === "string") return obj.text
    if (typeof obj.prompt === "string") return obj.prompt
    return JSON.stringify(obj, null, 2)
  }
  return String(content)
}

function formatMsgTime(dateVal: string | Date): string {
  try {
    const d = new Date(dateVal)
    const dateStr = d.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    })
    const timeStr = d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    return `${dateStr}, ${timeStr}`
  } catch {
    return ""
  }
}

export function ConversationTimeline({
  messages,
  activeRun,
  activeRunSteps,
  onCancelRun,
  isCancelling,
  agentName,
  isOptimisticRunning,
  isLoading = false,
}: ConversationTimelineProps) {
  const isActiveRunOngoing =
    isOptimisticRunning ||
    activeRun?.status === "queued" ||
    activeRun?.status === "running"

  return (
    <MessageScrollerProvider defaultScrollPosition="end" autoScroll>
      <MessageScroller className="flex-1">
        <MessageScrollerViewport className="border-none! px-4 py-6 ring-2! outline-none!">
          <MessageScrollerContent className="mx-auto max-w-4xl space-y-6">
            {isLoading ? (
              <div className="space-y-6 py-4">
                <Skeleton className="h-16 w-full rounded-2xl sm:w-[480px]" />
                <Skeleton className="ml-auto h-16 w-full max-w-40 rounded-2xl sm:w-[480px]" />
                <Skeleton className="h-16 w-full rounded-2xl sm:w-[480px]" />
                <Skeleton className="ml-auto h-16 w-full max-w-40 rounded-2xl sm:w-[480px]" />
                <Skeleton className="h-16 w-full rounded-2xl sm:w-[480px]" />
                <Skeleton className="ml-auto h-16 w-full max-w-40 rounded-2xl sm:w-[480px]" />
                <Skeleton className="h-16 w-full rounded-2xl sm:w-[480px]" />
                <Skeleton className="ml-auto h-16 w-full max-w-40 rounded-2xl sm:w-[480px]" />
              </div>
            ) : messages.length === 0 && !activeRun ? (
              <MessageScrollerItem>
                <div className="py-16 text-center">
                  <div className="flex items-center justify-center">
                    <Blobatar
                      name={agentName}
                      alt={agentName}
                      className={"size-10!"}
                    />
                  </div>
                  <h3 className="font-heading text-sm font-medium text-foreground">
                    Ready to chat with {agentName}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Send a task or query below. The agent will execute tool
                    steps as needed and return the verified output.
                  </p>
                </div>
              </MessageScrollerItem>
            ) : null}

            {/* Existing Persisted Messages */}
            {!isLoading &&
              messages.map((msg) => {
                const isUser = msg.role === "user"
                const text = getMessageText(msg.content)

                return (
                  <MessageScrollerItem key={msg.id} messageId={msg.id}>
                    <MessageGroup>
                      <Message
                        align={isUser ? "end" : "start"}
                        className="gap-2"
                      >
                        <MessageContent>
                          <Bubble
                            variant={isUser ? "default" : "secondary"}
                            align={isUser ? "end" : "start"}
                          >
                            <BubbleContent
                              className={
                                isUser
                                  ? "p-1.5 px-2.5 text-xs whitespace-pre-wrap text-foreground sm:text-sm"
                                  : "typeset typeset-chat p-1.5 px-2.5 text-xs text-foreground sm:text-sm"
                              }
                            >
                              {isUser ? text : <Markdown>{text}</Markdown>}
                            </BubbleContent>
                          </Bubble>

                          {isUser ? (
                            <MessageFooter className="justify-end gap-1 px-0">
                              <span className="text-xs font-medium text-foreground">
                                You
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatMsgTime(msg.createdAt)}
                              </span>
                            </MessageFooter>
                          ) : (
                            <MessageFooter className="gap-px px-0">
                              <Blobatar
                                name={agentName}
                                className="size-6 shrink-0"
                              />
                              <span className="text-xs font-medium text-foreground">
                                {agentName}
                              </span>
                              <span className="ml-1 text-[10px] text-muted-foreground">
                                {formatMsgTime(msg.createdAt)}
                              </span>
                            </MessageFooter>
                          )}
                        </MessageContent>
                      </Message>
                    </MessageGroup>
                  </MessageScrollerItem>
                )
              })}

            {/* Live Active In-Flight Run Stream */}
            {isActiveRunOngoing && (
              <MessageScrollerItem>
                <div className="space-y-3 py-1">
                  {/* Execution Tool Steps */}
                  {activeRunSteps.length > 0 && (
                    <ExecutionStepsCard
                      steps={activeRunSteps}
                      isLive={isActiveRunOngoing}
                    />
                  )}

                  {/* Agent Typing Indicator Message */}
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
                          />
                          <span className="text-xs font-medium text-foreground">
                            {agentName}
                          </span>
                        </MessageFooter>
                      </MessageContent>
                    </Message>
                  </MessageGroup>
                </div>
              </MessageScrollerItem>
            )}

            {/* Error or Cancelled Notice if run failed or was cancelled */}
            {activeRun &&
              !isActiveRunOngoing &&
              (activeRun.status === "failed" ||
                activeRun.status === "cancelled") && (
                <MessageScrollerItem>
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
                        <MarkerContent>
                          The run was halted safely.
                        </MarkerContent>
                      </Marker>
                    )}
                  </div>
                </MessageScrollerItem>
              )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
