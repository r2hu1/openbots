"use client"

import { ResizablePanel } from "@openbots/ui/components/resizable"
import * as React from "react"
import { AgentHeader } from "@/modules/agents/components/agent-header"
import type { ParsedArtifact } from "@/modules/artifacts/parser"
import { ConversationTimeline } from "@/modules/conversations/components/conversation-timeline"
import { InputComposer } from "@/modules/conversations/components/input-composer"
import type { MessageItem, ReplyTarget } from "@/modules/conversations/types"
import type { RunRecord, StepItem } from "@/modules/runs/types"

const MemoHeader = React.memo(AgentHeader)
const MemoTimeline = React.memo(ConversationTimeline)
const MemoComposer = React.memo(InputComposer)

interface WorkspaceChatPanelProps {
  isLivePreviewOpen: boolean
  headerProps?: {
    selectedAgent: any
    onOpenConfigure: () => void
    onOpenHistory: () => void
    onOpenConnections?: () => void
    onOpenSchedules?: () => void
  }
  hasLiveBrowser: boolean
  toggleBrowser: () => void
  messages: MessageItem[]
  activeRun: RunRecord | null
  activeRunSteps: StepItem[]
  cancelActiveRun: () => void
  isCancelling: boolean
  agentName: string
  isOptimisticRunning: boolean
  isChatLoading: boolean
  onOpenArtifact: (artifact: ParsedArtifact) => void
  hasOlderMessages: boolean
  isLoadingOlder: boolean
  fetchNextPage: () => void
  executionError: string | null
  clearExecutionError: () => void
  replyTarget: ReplyTarget | null
  setReplyTarget: (target: ReplyTarget | null) => void
  handleToggleReaction: (messageId: string, emoji: string) => void
  streamingText: string | null
  sendPrompt: (prompt: string, images?: string[], attachments?: any[]) => void
  isSubmitting: boolean
  isActiveRun: boolean
  placeholder: string
}

export function WorkspaceChatPanel({
  isLivePreviewOpen,
  headerProps,
  hasLiveBrowser,
  toggleBrowser,
  messages,
  activeRun,
  activeRunSteps,
  cancelActiveRun,
  isCancelling,
  agentName,
  isOptimisticRunning,
  isChatLoading,
  onOpenArtifact,
  hasOlderMessages,
  isLoadingOlder,
  fetchNextPage,
  executionError,
  clearExecutionError,
  replyTarget,
  setReplyTarget,
  handleToggleReaction,
  streamingText,
  sendPrompt,
  isSubmitting,
  isActiveRun,
  placeholder,
}: WorkspaceChatPanelProps) {
  return (
    <ResizablePanel
      defaultSize={isLivePreviewOpen ? 60 : 100}
      minSize={35}
      className="flex min-w-0 flex-col"
    >
      {headerProps && (
        <MemoHeader
          selectedAgent={headerProps.selectedAgent}
          onOpenConfigure={headerProps.onOpenConfigure}
          onOpenHistory={headerProps.onOpenHistory}
          onOpenConnections={headerProps.onOpenConnections}
          onOpenSchedules={headerProps.onOpenSchedules}
          isBrowserActive={hasLiveBrowser}
          isBrowserOpen={isLivePreviewOpen}
          onToggleBrowser={toggleBrowser}
        />
      )}

      <MemoTimeline
        messages={messages}
        activeRun={activeRun}
        activeRunSteps={activeRunSteps}
        onCancelRun={cancelActiveRun}
        isCancelling={isCancelling}
        agentName={agentName}
        isOptimisticRunning={isOptimisticRunning}
        isLoading={isChatLoading}
        onOpenArtifact={onOpenArtifact}
        hasOlderMessages={!!hasOlderMessages}
        isLoadingOlder={isLoadingOlder}
        onLoadOlderMessages={() => {
          if (hasOlderMessages && !isLoadingOlder) {
            fetchNextPage()
          }
        }}
        executionError={executionError}
        onDismissError={clearExecutionError}
        onReply={setReplyTarget}
        onReact={handleToggleReaction}
        streamingText={streamingText}
      />

      <MemoComposer
        onSend={sendPrompt}
        isSubmitting={isSubmitting}
        isActiveRun={isActiveRun}
        onCancelRun={cancelActiveRun}
        isCancelling={isCancelling}
        placeholder={placeholder}
        replyTarget={replyTarget}
        onClearReply={() => setReplyTarget(null)}
      />
    </ResizablePanel>
  )
}
