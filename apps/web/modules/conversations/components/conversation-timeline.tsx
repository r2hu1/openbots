"use client";

import { Button } from "@openbots/ui/components/button";
import {
  Marker,
  MarkerContent,
  MarkerIcon,
} from "@openbots/ui/components/marker";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@openbots/ui/components/message-scroller";
import { Spinner } from "@openbots/ui/components/spinner";
import { Blobatar } from "@openbots/ui/components/ui/blobatar";
import { IconAlertCircle, IconChevronUp, IconX } from "@tabler/icons-react";
import * as React from "react";
import type { ParsedArtifact } from "@/modules/artifacts/parser";
import type { RunRecord, StepItem } from "@/modules/runs/types";
import type { MessageItem } from "../types";
import { ConversationLiveStatus } from "./conversation-live-status";
import { ConversationMessageItem } from "./conversation-message-item";

interface ConversationTimelineProps {
  messages: MessageItem[];
  activeRun: RunRecord | null;
  activeRunSteps: StepItem[];
  onCancelRun?: () => void;
  isCancelling?: boolean;
  agentName: string;
  isOptimisticRunning?: boolean;
  isLoading?: boolean;
  onOpenArtifact?: (artifact: ParsedArtifact) => void;
  hasOlderMessages?: boolean;
  isLoadingOlder?: boolean;
  onLoadOlderMessages?: () => void;
  executionError?: string | null;
  onDismissError?: () => void;
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
}: ConversationTimelineProps) {
  const isActiveRunOngoing =
    isOptimisticRunning ||
    activeRun?.status === "queued" ||
    activeRun?.status === "running";

  const topSentinelRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  // IntersectionObserver to auto-fetch when scrolling near the top
  React.useEffect(() => {
    if (!hasOlderMessages || isLoadingOlder || !onLoadOlderMessages) return;

    const sentinel = topSentinelRef.current;
    if (!sentinel) return;

    // Find the closest scrollable container (the viewport)
    const scrollContainer =
      sentinel.closest<HTMLElement>(
        "[data-slot='message-scroller-viewport']",
      ) || sentinel.parentElement;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadOlderMessages();
        }
      },
      {
        root: scrollContainer,
        rootMargin: "200px 0px 0px 0px",
        threshold: 0,
      },
    );

    observer.observe(sentinel);

    // Also attach native scroll listener directly to the scroll container
    const handleScrollEvent = () => {
      if (scrollContainer && scrollContainer.scrollTop <= 150) {
        onLoadOlderMessages();
      }
    };

    scrollContainer?.addEventListener("scroll", handleScrollEvent, {
      passive: true,
    });

    return () => {
      observer.disconnect();
      scrollContainer?.removeEventListener("scroll", handleScrollEvent);
    };
  }, [hasOlderMessages, isLoadingOlder, onLoadOlderMessages]);

  // Also attach onScroll on viewport as a resilient fallback
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!hasOlderMessages || isLoadingOlder || !onLoadOlderMessages) return;
    const target = e.currentTarget;
    if (target.scrollTop <= 120) {
      onLoadOlderMessages();
    }
  };

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
                <MessageScrollerItem key={msg.id} messageId={msg.id}>
                  <ConversationMessageItem
                    message={msg}
                    agentName={agentName}
                    onOpenArtifact={onOpenArtifact}
                  />
                </MessageScrollerItem>
              ))}

            {(isActiveRunOngoing ||
              (activeRun &&
                (activeRun.status === "failed" ||
                  activeRun.status === "cancelled"))) && (
              <MessageScrollerItem>
                <ConversationLiveStatus
                  agentName={agentName}
                  activeRun={activeRun}
                  activeRunSteps={activeRunSteps}
                  isActiveRunOngoing={isActiveRunOngoing}
                />
              </MessageScrollerItem>
            )}

            {executionError && (
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
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
