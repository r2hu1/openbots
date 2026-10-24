"use client"

import {
  ResizableHandle,
  ResizablePanelGroup,
} from "@openbots/ui/components/resizable"
import * as React from "react"
import type { ParsedArtifact } from "@/modules/artifacts/parser"
import type { ReplyTarget } from "@/modules/conversations/types"
import { useHitlResponseMutation } from "@/modules/runs/queries"
import { useLiveBrowserSession } from "./use-live-browser-session"
import { useWorkspaceChat } from "./use-workspace-chat"
import { WorkspaceChatPanel } from "./workspace-chat-panel"
import { WorkspaceDesktopPanel } from "./workspace-desktop-panel"

interface ChatPaneProps {
  agentId: string
  agentName: string
  onOpenArtifact: (artifact: ParsedArtifact) => void
  onBrowserStateChange?: (state: {
    isActive: boolean
    isOpen: boolean
    toggle: () => void
  }) => void
  headerProps?: {
    selectedAgent: any
    onOpenConfigure: () => void
    onOpenHistory: () => void
    onOpenConnections?: () => void
    onOpenSchedules?: () => void
    onOpenMemory?: () => void
  }
}

export const ChatPane = React.memo(function ChatPane({
  agentId,
  agentName,
  onOpenArtifact,
  onBrowserStateChange,
  headerProps,
}: ChatPaneProps) {
  const [replyTarget, setReplyTarget] = React.useState<ReplyTarget | null>(null)

  const {
    activeConversationId,
    execution,
    conversationInfiniteData,
    messages,
    isLoadingOlder,
    hasOlderMessages,
    fetchNextPage,
    handleToggleReaction,
    isChatLoading,
  } = useWorkspaceChat({ agentId })

  const {
    liveBrowserData,
    activeHitlPrompt,
    hasLiveBrowser,
    isLivePreviewOpen,
    toggleBrowser,
    handleClosePreview,
  } = useLiveBrowserSession({
    activeConversationId,
    activeRunId: execution.activeRun?.id,
    activeRunSteps: execution.activeRunSteps,
    messages,
    conversationInfiniteData,
    isActiveRun: execution.isActiveRun,
  })

  React.useEffect(() => {
    onBrowserStateChange?.({
      isActive: hasLiveBrowser,
      isOpen: isLivePreviewOpen,
      toggle: toggleBrowser,
    })
  }, [hasLiveBrowser, isLivePreviewOpen, toggleBrowser, onBrowserStateChange])

  const hitlMutation = useHitlResponseMutation()

  const handleHitlResponse = React.useCallback(
    (runId: string, action: "completed" | "skipped") => {
      hitlMutation.mutate({
        runId,
        action,
        contextKey: activeConversationId || agentId,
      })
    },
    [hitlMutation, activeConversationId, agentId]
  )

  const placeholder = `Message ${agentName}...`

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        <WorkspaceChatPanel
          isLivePreviewOpen={isLivePreviewOpen}
          headerProps={headerProps}
          hasLiveBrowser={hasLiveBrowser}
          toggleBrowser={toggleBrowser}
          messages={messages}
          activeRun={execution.activeRun}
          activeRunSteps={execution.activeRunSteps}
          cancelActiveRun={execution.cancelActiveRun}
          isCancelling={execution.isCancelling}
          agentName={agentName}
          isOptimisticRunning={execution.isOptimisticRunning}
          isChatLoading={isChatLoading}
          onOpenArtifact={onOpenArtifact}
          hasOlderMessages={!!hasOlderMessages}
          isLoadingOlder={isLoadingOlder}
          fetchNextPage={fetchNextPage}
          executionError={execution.executionError}
          clearExecutionError={execution.clearExecutionError}
          replyTarget={replyTarget}
          setReplyTarget={setReplyTarget}
          handleToggleReaction={handleToggleReaction}
          streamingText={execution.streamingText}
          sendPrompt={execution.sendPrompt}
          isSubmitting={execution.isSubmitting}
          isActiveRun={execution.isActiveRun}
          placeholder={placeholder}
        />

        {isLivePreviewOpen && (
          <>
            <ResizableHandle
              withHandle
              className="bg-border/60 transition-colors hover:bg-primary/40"
            />
            <WorkspaceDesktopPanel
              isOpen={isLivePreviewOpen}
              liveViewUrl={liveBrowserData?.liveViewUrl ?? null}
              currentUrl={liveBrowserData?.currentUrl}
              title={liveBrowserData?.title}
              onClose={handleClosePreview}
              hitlPrompt={activeHitlPrompt}
              onHitlResponse={handleHitlResponse}
              isSubmittingHitl={hitlMutation.isPending}
              agentName={agentName}
            />
          </>
        )}
      </ResizablePanelGroup>
    </div>
  )
})
