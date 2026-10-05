"use client"

import { Button } from "@openbots/ui/components/button"
import {
  Marker,
  MarkerContent,
  MarkerIcon,
} from "@openbots/ui/components/marker"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@openbots/ui/components/message-scroller"
import { Spinner } from "@openbots/ui/components/spinner"
import { Blobatar } from "@openbots/ui/components/ui/blobatar"
import { IconAlertCircle, IconChevronUp, IconX } from "@tabler/icons-react"
import * as React from "react"
import { ChevronDown } from "reicon-react"
import type { ParsedArtifact } from "@/modules/artifacts/parser"
import type { RunRecord, StepItem } from "@/modules/runs/types"
import type { MessageItem, ReplyTarget } from "../types"
import { ConversationLiveStatus } from "./conversation-live-status"
import { ConversationMessageItem } from "./conversation-message-item"

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
  const isActiveRunOngoing =
    isOptimisticRunning ||
    activeRun?.status === "queued" ||
    activeRun?.status === "running"

  const topSentinelRef = React.useRef<HTMLDivElement>(null)
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const isFetchingOlderRef = React.useRef(false)
  const prevScrollHeightRef = React.useRef<number | null>(null)
  const prevScrollTopRef = React.useRef<number | null>(null)

  // Track fetching state
  React.useEffect(() => {
    isFetchingOlderRef.current = isLoadingOlder
  }, [isLoadingOlder])

  // Trigger loading older messages safely
  const triggerLoadOlder = React.useCallback(() => {
    if (
      !hasOlderMessages ||
      isLoadingOlder ||
      isFetchingOlderRef.current ||
      !onLoadOlderMessages
    ) {
      return
    }

    const viewport =
      viewportRef.current ||
      topSentinelRef.current?.closest<HTMLElement>(
        "[data-slot='message-scroller-viewport']"
      )

    if (viewport) {
      prevScrollHeightRef.current = viewport.scrollHeight
      prevScrollTopRef.current = viewport.scrollTop
    }

    isFetchingOlderRef.current = true
    onLoadOlderMessages()
  }, [hasOlderMessages, isLoadingOlder, onLoadOlderMessages])

  // Preserve scroll position when messages prepend
  React.useLayoutEffect(() => {
    if (prevScrollHeightRef.current !== null) {
      const viewport =
        viewportRef.current ||
        topSentinelRef.current?.closest<HTMLElement>(
          "[data-slot='message-scroller-viewport']"
        )

      if (viewport) {
        const heightDiff = viewport.scrollHeight - prevScrollHeightRef.current
        if (heightDiff > 0 && prevScrollTopRef.current !== null) {
          viewport.scrollTop = prevScrollTopRef.current + heightDiff
        }
      }
      prevScrollHeightRef.current = null
      prevScrollTopRef.current = null
    }
  }, [messages.length])

  // IntersectionObserver to auto-fetch when scrolling near the top
  React.useEffect(() => {
    if (!hasOlderMessages || isLoadingOlder || !onLoadOlderMessages) return

    const sentinel = topSentinelRef.current
    if (!sentinel) return

    const scrollContainer =
      sentinel.closest<HTMLElement>(
        "[data-slot='message-scroller-viewport']"
      ) || sentinel.parentElement

    if (!scrollContainer) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        // Only trigger if sentinel is intersecting AND the user has scrolled (scrollTop is not 0 due to empty list)
        if (
          entry?.isIntersecting &&
          scrollContainer.scrollTop <= 80 &&
          scrollContainer.scrollHeight > scrollContainer.clientHeight
        ) {
          triggerLoadOlder()
        }
      },
      {
        root: scrollContainer,
        rootMargin: "100px 0px 0px 0px",
        threshold: 0.1,
      }
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [hasOlderMessages, isLoadingOlder, onLoadOlderMessages, triggerLoadOlder])

  // Also attach onScroll on viewport as a resilient fallback
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    if (
      hasOlderMessages &&
      !isLoadingOlder &&
      !isFetchingOlderRef.current &&
      target.scrollTop <= 60 &&
      target.scrollHeight > target.clientHeight
    ) {
      triggerLoadOlder()
    }
  }

  // Scroll to targeted message if URL hash is present (e.g., #message-123)
  // If the message is older and not loaded yet, fetch older pages until it appears
  const targetMessageIdRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (typeof window === "undefined") return

    const updateTargetFromHash = () => {
      const hash = window.location.hash
      if (hash && hash.startsWith("#message-")) {
        targetMessageIdRef.current = hash.slice(1) // "message-<id>"
      }
    }

    const handleNavigate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        messageId?: string
      }>
      if (customEvent.detail?.messageId) {
        targetMessageIdRef.current = `message-${customEvent.detail.messageId}`
      }
    }

    updateTargetFromHash()
    window.addEventListener("hashchange", updateTargetFromHash)
    window.addEventListener("openbots:navigate-message", handleNavigate)

    return () => {
      window.removeEventListener("hashchange", updateTargetFromHash)
      window.removeEventListener("openbots:navigate-message", handleNavigate)
    }
  }, [])

  React.useEffect(() => {
    if (isLoading) return
    const targetId = targetMessageIdRef.current
    if (!targetId) return

    const el = document.getElementById(targetId)
    if (el) {
      const viewport =
        viewportRef.current ||
        topSentinelRef.current?.closest<HTMLElement>(
          "[data-slot='message-scroller-viewport']"
        )

      if (viewport) {
        // Calculate exact target scrollTop so element is centered in the scrollable viewport
        const viewportRect = viewport.getBoundingClientRect()
        const elRect = el.getBoundingClientRect()
        const relativeTop = elRect.top - viewportRect.top
        const targetScrollTop =
          viewport.scrollTop +
          relativeTop -
          (viewport.clientHeight - elRect.height) / 2

        viewport.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: "smooth",
        })
      } else {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      }

      el.classList.add(
        "ring-2",
        "ring-primary/50",
        "rounded-xl",
        "transition-all"
      )
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary/50")
      }, 2500)
      targetMessageIdRef.current = null

      // Clean up URL query parameters (?conversationId=...) and hash (#message-...)
      if (typeof window !== "undefined" && window.history.replaceState) {
        const cleanUrl = window.location.pathname
        window.history.replaceState(null, "", cleanUrl)
      }
      return
    }

    // Message element not yet loaded in DOM
    // If there are older messages available and we aren't currently loading, fetch next page
    if (
      hasOlderMessages &&
      !isLoadingOlder &&
      !isFetchingOlderRef.current &&
      onLoadOlderMessages
    ) {
      triggerLoadOlder()
    } else if (!hasOlderMessages && !isLoadingOlder) {
      // Reached the earliest message and still not found, clear target
      targetMessageIdRef.current = null
    }
  }, [
    isLoading,
    messages.length,
    hasOlderMessages,
    isLoadingOlder,
    onLoadOlderMessages,
    triggerLoadOlder,
  ])

  return (
    <MessageScrollerProvider defaultScrollPosition="end" autoScroll>
      <MessageScroller className="flex-1">
        <MessageScrollerViewport
          ref={viewportRef}
          onScroll={handleScroll}
          className="border-none! px-4 py-6 ring-2! outline-none!"
        >
          <MessageScrollerContent className="mx-auto max-w-4xl space-y-6">
            <div
              ref={topSentinelRef}
              className="pointer-events-none h-1 w-full"
            />

            {hasOlderMessages && (
              <div className="flex min-h-8 justify-center py-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onLoadOlderMessages}
                  disabled={isLoadingOlder}
                >
                  <Marker>
                    <MarkerContent className="flex shimmer items-center gap-2">
                      {isLoadingOlder ? (
                        <>
                          <Spinner className="size-3.5" />
                          <span>Loading older messages...</span>
                        </>
                      ) : (
                        <>
                          <IconChevronUp className="size-3.5" />
                          <span>Load older messages</span>
                        </>
                      )}
                    </MarkerContent>
                  </Marker>
                </Button>
              </div>
            )}

            {isLoading ? (
              <div className="space-y-6 py-30">
                <Spinner className="mx-auto size-6" />
              </div>
            ) : messages.length === 0 && !activeRun && !executionError ? (
              <MessageScrollerItem>
                <div className="mx-auto max-w-lg py-20 text-center">
                  <div className="flex items-center justify-center">
                    <Blobatar
                      name={agentName}
                      alt={agentName}
                      className="size-14!"
                      blobatar={{ animate: "always" }}
                    />
                  </div>
                  <h3 className="font-heading text-base font-medium text-foreground">
                    Ready to chat with {agentName}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Send a task or query below. The agent will execute tool
                    steps as needed and return the verified output.
                  </p>
                </div>
              </MessageScrollerItem>
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

            {/* Live tool execution steps */}
            {isActiveRunOngoing && activeRunSteps.length > 0 && (
              <MessageScrollerItem key="live-steps">
                <ConversationLiveStatus
                  agentName={agentName}
                  activeRun={activeRun}
                  activeRunSteps={activeRunSteps}
                  isActiveRunOngoing={true}
                  hasStreamingContent={true}
                />
              </MessageScrollerItem>
            )}

            {/* Assistant message: streaming text if available, or thinking indicator while ongoing */}
            {streamingText ? (
              <MessageScrollerItem
                key={`streaming-${activeRun?.id || "current"}`}
                id={`streaming-${activeRun?.id || "current"}`}
              >
                <ConversationMessageItem
                  message={{
                    id: `streaming-${activeRun?.id || "current"}`,
                    conversationId: activeRun?.conversationId || "current",
                    role: "assistant",
                    content: { text: streamingText },
                    createdAt: new Date(),
                  }}
                  agentName={agentName}
                  isStreaming={true}
                  onOpenArtifact={onOpenArtifact}
                />
              </MessageScrollerItem>
            ) : isActiveRunOngoing ? (
              <MessageScrollerItem
                key={`thinking-${activeRun?.id || "current"}`}
                id={`thinking-${activeRun?.id || "current"}`}
              >
                <ConversationLiveStatus
                  agentName={agentName}
                  activeRun={activeRun}
                  activeRunSteps={[]}
                  isActiveRunOngoing={true}
                  hasStreamingContent={false}
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
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                  <div className="flex items-start gap-2.5">
                    <IconAlertCircle className="size-4.5 shrink-0 translate-y-0.5 text-destructive" />
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-semibold">
                        Unable to run agent
                      </p>
                      <p className="text-xs leading-relaxed opacity-90">
                        {executionError}
                      </p>
                    </div>
                    {onDismissError && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={onDismissError}
                        className="size-5 text-destructive hover:bg-destructive/20"
                        title="Dismiss error"
                      >
                        <IconX className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton variant="outline" />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
