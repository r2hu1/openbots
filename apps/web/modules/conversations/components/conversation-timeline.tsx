"use client";

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
}

export function ConversationTimeline({
  messages,
  activeRun,
  activeRunSteps,
  agentName,
  isOptimisticRunning = false,
  isLoading = false,
}: ConversationTimelineProps) {
  const isActiveRunOngoing =
    isOptimisticRunning ||
    activeRun?.status === "queued" ||
    activeRun?.status === "running";

  return (
    <MessageScrollerProvider defaultScrollPosition="end" autoScroll>
      <MessageScroller className="flex-1">
        <MessageScrollerViewport className="border-none! px-4 py-6 ring-2! outline-none!">
          <MessageScrollerContent className="mx-auto max-w-4xl space-y-6">
            {isLoading ? (
              <div className="space-y-6 py-30">
                <Spinner className="mx-auto size-6" />
              </div>
            ) : messages.length === 0 && !activeRun ? (
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
                  hasStreamingContent={messages.some((m) => m.id.startsWith("opt-streaming-"))}
                />
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
