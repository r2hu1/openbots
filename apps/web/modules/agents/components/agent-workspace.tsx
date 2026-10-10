"use client"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@openbots/ui/components/resizable"
import { SidebarInset } from "@openbots/ui/components/sidebar"
import { useHotkey } from "@openbots/ui/hooks/use-hotkey"
import { IconPlus } from "@tabler/icons-react"
import { useQueryClient } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import * as React from "react"
import { EmptyState } from "@/components/shared/empty-state"
import { LoadingState } from "@/components/shared/loading-state"
import { AgentHeader } from "@/modules/agents/components/agent-header"
import { useAgentExecution } from "@/modules/agents/hooks/use-agent-execution"
import { useAgentsQuery } from "@/modules/agents/queries"
import type { ParsedArtifact } from "@/modules/artifacts/parser"
import { ConversationTimeline } from "@/modules/conversations/components/conversation-timeline"
import { InputComposer } from "@/modules/conversations/components/input-composer"
import { useReconciledMessages } from "@/modules/conversations/hooks/use-reconciled-messages"
import {
  useConversationsQuery,
  useInfiniteConversationDetailQuery,
  useToggleMessageReactionMutation,
} from "@/modules/conversations/queries"
import type { ReplyTarget } from "@/modules/conversations/types"
import { useHitlResponseMutation } from "@/modules/runs/queries"

const ConfigureAgentSheet = dynamic(
  () =>
    import("@/modules/agents/components/configure-agent-sheet").then(
      (m) => m.ConfigureAgentSheet
    ),
  { ssr: false }
)
const CreateAgentDialog = dynamic(
  () =>
    import("@/modules/agents/components/create-agent-dialog").then(
      (m) => m.CreateAgentDialog
    ),
  { ssr: false }
)
const ArtifactSheet = dynamic(
  () =>
    import("@/modules/artifacts/artifact-sheet").then((m) => m.ArtifactSheet),
  { ssr: false }
)
const ConnectionsSheet = dynamic(
  () =>
    import("@/modules/connections/components/connections-sheet").then(
      (m) => m.ConnectionsSheet
    ),
  { ssr: false }
)
const RunHistorySheet = dynamic(
  () =>
    import("@/modules/runs/components/run-history-sheet").then(
      (m) => m.RunHistorySheet
    ),
  { ssr: false }
)
const SchedulesSheet = dynamic(
  () =>
    import("@/modules/schedules/components/schedules-sheet").then(
      (m) => m.SchedulesSheet
    ),
  { ssr: false }
)
const BrowserLivePreview = dynamic(
  () =>
    import("@/modules/browserbase/browser-live-preview").then(
      (m) => m.BrowserLivePreview
    ),
  { ssr: false }
)

function useIdleReady() {
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => setReady(true), {
        timeout: 2000,
      })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(() => setReady(true), 200)
    return () => window.clearTimeout(id)
  }, [])

  return ready
}

function useMountedOnce(open: boolean) {
  const mounted = React.useRef(false)
  if (open) mounted.current = true
  return mounted.current
}

const MemoHeader = React.memo(AgentHeader)
const MemoTimeline = React.memo(ConversationTimeline)
const MemoComposer = React.memo(InputComposer)

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
  }
}

const ChatPane = React.memo(function ChatPane({
  agentId,
  agentName,
  onOpenArtifact,
  onBrowserStateChange,
  headerProps,
}: ChatPaneProps) {
  const [selectedConversationId, setSelectedConversationId] = React.useState<
    string | null
  >(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get("conversationId")
    }
    return null
  })

  React.useEffect(() => {
    const handleNavigate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        agentId: string
        conversationId?: string
        messageId?: string
      }>
      if (
        customEvent.detail?.agentId === agentId &&
        customEvent.detail?.conversationId
      ) {
        setSelectedConversationId(customEvent.detail.conversationId)
      }
    }

    window.addEventListener("openbots:navigate-message", handleNavigate)
    return () => {
      window.removeEventListener("openbots:navigate-message", handleNavigate)
    }
  }, [agentId])

  const [replyTarget, setReplyTarget] = React.useState<ReplyTarget | null>(null)

  const { data: conversationsData, isLoading: isLoadingConversations } =
    useConversationsQuery(agentId)
  const conversations = React.useMemo(
    () => conversationsData ?? [],
    [conversationsData]
  )

  const activeConversationId =
    selectedConversationId ?? conversations[0]?.id ?? null

  const {
    activeRun,
    activeRunSteps,
    streamingText,
    isActiveRun,
    isOptimisticRunning,
    optimisticMessages,
    setOptimisticMessages,
    sendPrompt,
    cancelActiveRun,
    isSubmitting,
    isCancelling,
    executionError,
    clearExecutionError,
  } = useAgentExecution({
    agentId,
    activeConversationId,
    onConversationCreated: setSelectedConversationId,
  })

  const {
    data: conversationInfiniteData,
    isLoading: isLoadingMessages,
    isFetchingNextPage: isLoadingOlder,
    hasNextPage: hasOlderMessages,
    fetchNextPage,
  } = useInfiniteConversationDetailQuery(activeConversationId, {
    refetchInterval: false,
  })

  // Combine pages: older pages are fetched later and prepend to the timeline
  const serverMessages = React.useMemo(() => {
    if (!conversationInfiniteData?.pages) return []
    // Pages are in order [page0, page1, ...], where page0 is newest, page1 is older.
    // Each page's messages are already chronological (oldest to newest).
    // So to display oldest -> newest overall: [...pageN.messages, ..., page0.messages]
    const pages = [...conversationInfiniteData.pages].reverse()
    return pages.flatMap((p) => p.messages ?? [])
  }, [conversationInfiniteData?.pages])

  const clearOptimistic = React.useCallback(
    () => setOptimisticMessages([]),
    [setOptimisticMessages]
  )

  const messages = useReconciledMessages({
    serverMessages,
    optimisticMessages,
    activeRun,
    activeConversationId,
    onClearOptimistic: clearOptimistic,
  })

  const queryClient = useQueryClient()
  const toggleReactionMutation =
    useToggleMessageReactionMutation(activeConversationId)

  const handleToggleReaction = React.useCallback(
    (messageId: string, emoji: string) => {
      toggleReactionMutation.mutate(
        { messageId, emoji },
        {
          onSuccess: () => {
            if (activeConversationId) {
              queryClient.invalidateQueries({
                queryKey: ["conversation", activeConversationId],
              })
            }
          },
        }
      )
    },
    [activeConversationId, toggleReactionMutation, queryClient]
  )

  const isChatLoading =
    !isOptimisticRunning &&
    optimisticMessages.length === 0 &&
    (isLoadingConversations ||
      (activeConversationId !== null && isLoadingMessages))

  const placeholder = `Message ${agentName}...`

  // Retain the last known active browser data so that when a run finishes
  // and streaming steps clear before query refetch completes, the preview doesn't flash closed and open.
  const lastKnownBrowserRef = React.useRef<{
    conversationId: string | null
    data: {
      liveViewUrl: string
      currentUrl?: string
      title?: string
    }
  } | null>(null)

  // Reset cached browser data when conversation or agent changes
  React.useEffect(() => {
    if (
      lastKnownBrowserRef.current &&
      lastKnownBrowserRef.current.conversationId !== activeConversationId
    ) {
      lastKnownBrowserRef.current = null
    }
  }, [activeConversationId])

  // Inspect active run steps and recent messages for any Browserbase live view metadata
  const liveBrowserData = React.useMemo(() => {
    // 1. Check active streaming run steps first (live execution)
    for (let i = activeRunSteps.length - 1; i >= 0; i--) {
      const step = activeRunSteps[i]
      if (!step) continue
      const output = step.toolOutput as Record<string, any> | null
      if (output?.liveViewUrl) {
        const result = {
          liveViewUrl: output.liveViewUrl as string,
          currentUrl: (output.currentUrl || output.url) as string | undefined,
          title: output.title as string | undefined,
        }
        lastKnownBrowserRef.current = {
          conversationId: activeConversationId,
          data: result,
        }
        return result
      }
    }

    // 2. Check recent messages for tool steps with liveViewUrl
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (!msg) continue
      const meta = msg.metadata as Record<string, any> | null
      if (meta?.liveViewUrl) {
        const result = {
          liveViewUrl: meta.liveViewUrl as string,
          currentUrl: (meta.currentUrl || meta.url) as string | undefined,
          title: meta.title as string | undefined,
        }
        lastKnownBrowserRef.current = {
          conversationId: activeConversationId,
          data: result,
        }
        return result
      }
      if (Array.isArray(meta?.steps)) {
        for (let j = meta.steps.length - 1; j >= 0; j--) {
          const step = meta.steps[j]
          const output = step?.toolOutput as Record<string, any> | null
          if (output?.liveViewUrl) {
            const result = {
              liveViewUrl: output.liveViewUrl as string,
              currentUrl: (output.currentUrl || output.url) as
                string | undefined,
              title: output.title as string | undefined,
            }
            lastKnownBrowserRef.current = {
              conversationId: activeConversationId,
              data: result,
            }
            return result
          }
        }
      }
      // Check content if it is an object with liveViewUrl
      if (typeof msg.content === "object" && msg.content !== null) {
        const contentObj = msg.content as Record<string, any>
        if (contentObj.liveViewUrl) {
          const result = {
            liveViewUrl: contentObj.liveViewUrl as string,
            currentUrl: (contentObj.currentUrl || contentObj.url) as
              string | undefined,
            title: contentObj.title as string | undefined,
          }
          lastKnownBrowserRef.current = {
            conversationId: activeConversationId,
            data: result,
          }
          return result
        }
      }
    }

    // 3. Check conversation-level active browser session from server / Redis
    const conversationActiveBrowser =
      conversationInfiniteData?.pages?.[0]?.activeBrowser
    if (
      conversationActiveBrowser?.liveDebuggerFullscreenUrl ||
      conversationActiveBrowser?.liveDebuggerUrl
    ) {
      const result = {
        liveViewUrl: (conversationActiveBrowser.liveDebuggerFullscreenUrl ||
          conversationActiveBrowser.liveDebuggerUrl) as string,
        currentUrl: undefined,
        title: undefined,
      }
      lastKnownBrowserRef.current = {
        conversationId: activeConversationId,
        data: result,
      }
      return result
    }

    // 4. Fall back to cached session for this conversation so it doesn't flicker during SSE step transitions
    if (
      lastKnownBrowserRef.current &&
      lastKnownBrowserRef.current.conversationId === activeConversationId
    ) {
      return lastKnownBrowserRef.current.data
    }

    return null
  }, [
    activeRunSteps,
    messages,
    conversationInfiniteData?.pages,
    activeConversationId,
  ])

  const [previewManuallyClosed, setPreviewManuallyClosed] =
    React.useState(false)

  // Auto-open live preview whenever a browser action produces a live view URL
  React.useEffect(() => {
    if (liveBrowserData?.liveViewUrl) {
      setPreviewManuallyClosed(false)
    }
  }, [liveBrowserData?.liveViewUrl])

  const hasLiveBrowser = Boolean(liveBrowserData?.liveViewUrl)
  const isLivePreviewOpen = Boolean(hasLiveBrowser && !previewManuallyClosed)

  const toggleBrowser = React.useCallback(() => {
    setPreviewManuallyClosed((prev) => !prev)
  }, [])

  React.useEffect(() => {
    onBrowserStateChange?.({
      isActive: hasLiveBrowser,
      isOpen: isLivePreviewOpen,
      toggle: toggleBrowser,
    })
  }, [hasLiveBrowser, isLivePreviewOpen, toggleBrowser, onBrowserStateChange])

  const hitlMutation = useHitlResponseMutation()

  // Detect if active run is paused waiting for user input via browser_wait_for_user
  const activeHitlPrompt = React.useMemo(() => {
    if (!activeRun?.id) return null
    const pendingStep = [...activeRunSteps]
      .reverse()
      .find(
        (s) => s.toolName === "browser_wait_for_user" && s.status === "running"
      )
    if (!pendingStep) return null

    const input = (pendingStep.toolInput || {}) as Record<string, any>
    const instruction =
      (typeof input.instruction === "string" ? input.instruction : null) ||
      (typeof input.message === "string" ? input.message : null) ||
      "Please complete the action in the browser."

    return {
      runId: activeRun.id,
      instruction,
    }
  }, [activeRun?.id, activeRunSteps])

  // If there is an active HITL request, ensure browser panel is open
  React.useEffect(() => {
    if (activeHitlPrompt && hasLiveBrowser) {
      setPreviewManuallyClosed(false)
    }
  }, [activeHitlPrompt, hasLiveBrowser])

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

  const handleClosePreview = React.useCallback(() => {
    lastKnownBrowserRef.current = null
    setPreviewManuallyClosed(true)
  }, [])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        {/* Main Chat Panel (including Agent Header, Timeline, and Composer) */}
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

        {isLivePreviewOpen && (
          <>
            {/* Resizable Separator Handle */}
            <ResizableHandle
              withHandle
              className="bg-border/60 transition-colors hover:bg-primary/40"
            />

            {/* Browser Live Preview Panel */}
            <ResizablePanel
              defaultSize={40}
              minSize={25}
              className="flex min-w-0 flex-col"
            >
              <BrowserLivePreview
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
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  )
})

interface AgentWorkspaceProps {
  initialAgentId?: string
}

export function AgentWorkspace({ initialAgentId }: AgentWorkspaceProps) {
  const router = useRouter()

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [configureSheetOpen, setConfigureSheetOpen] = React.useState(false)
  const [historySheetOpen, setHistorySheetOpen] = React.useState(false)
  const [connectionsSheetOpen, setConnectionsSheetOpen] = React.useState(false)
  const [schedulesSheetOpen, setSchedulesSheetOpen] = React.useState(false)
  const [inspectedRunId, setInspectedRunId] = React.useState<string | null>(
    null
  )
  const [selectedArtifact, setSelectedArtifact] =
    React.useState<ParsedArtifact | null>(null)

  const lastArtifact = React.useRef<ParsedArtifact | null>(null)
  if (selectedArtifact) lastArtifact.current = selectedArtifact

  const { data: agentsData, isLoading: isLoadingAgents } = useAgentsQuery()
  const agents = React.useMemo(() => agentsData ?? [], [agentsData])

  const selectedAgentId = initialAgentId ?? agents[0]?.id ?? null
  const selectedAgent = React.useMemo(
    () => agents.find((ag) => ag.id === selectedAgentId) ?? null,
    [agents, selectedAgentId]
  )

  React.useEffect(() => {
    if (!initialAgentId && agents[0]?.id) {
      router.replace(`/agent/${agents[0].id}`)
    } else if (!isLoadingAgents && initialAgentId && !selectedAgent) {
      router.replace("/")
    }
  }, [initialAgentId, agents, isLoadingAgents, selectedAgent, router])

  const openConfigure = React.useCallback(() => setConfigureSheetOpen(true), [])
  const openHistory = React.useCallback(() => {
    setInspectedRunId(null)
    setHistorySheetOpen(true)
  }, [])
  const openConnections = React.useCallback(
    () => setConnectionsSheetOpen(true),
    []
  )
  const openSchedules = React.useCallback(() => setSchedulesSheetOpen(true), [])
  const openCreate = React.useCallback(() => setCreateDialogOpen(true), [])
  useHotkey("mod+shift+a", openCreate)
  const openArtifact = React.useCallback(
    (artifact: ParsedArtifact) => setSelectedArtifact(artifact),
    []
  )
  const handleArtifactOpenChange = React.useCallback((open: boolean) => {
    if (!open) setSelectedArtifact(null)
  }, [])
  const handleAgentCreated = React.useCallback(
    (newId: string) => router.push(`/agent/${newId}`),
    [router]
  )

  const idleReady = useIdleReady()
  const createMounted = useMountedOnce(createDialogOpen) || idleReady
  const configureMounted = useMountedOnce(configureSheetOpen) || idleReady
  const historyMounted = useMountedOnce(historySheetOpen) || idleReady
  const connectionsMounted = useMountedOnce(connectionsSheetOpen) || idleReady
  const schedulesMounted = useMountedOnce(schedulesSheetOpen) || idleReady
  const artifactMounted = useMountedOnce(Boolean(selectedArtifact)) || idleReady

  const [browserState, setBrowserState] = React.useState<{
    isActive: boolean
    isOpen: boolean
    toggle: () => void
  }>({
    isActive: false,
    isOpen: false,
    toggle: () => {},
  })

  const headerProps = React.useMemo(
    () => ({
      selectedAgent,
      onOpenConfigure: openConfigure,
      onOpenHistory: openHistory,
      onOpenConnections: openConnections,
      onOpenSchedules: openSchedules,
    }),
    [selectedAgent, openConfigure, openHistory, openConnections, openSchedules]
  )

  return (
    <>
      <SidebarInset className="flex flex-1 flex-col overflow-hidden">
        {!selectedAgent && (
          <MemoHeader
            selectedAgent={null}
            onOpenConfigure={openConfigure}
            onOpenHistory={openHistory}
            onOpenConnections={openConnections}
            onOpenSchedules={openSchedules}
            isBrowserActive={false}
            isBrowserOpen={false}
            onToggleBrowser={() => {}}
          />
        )}

        <main className="flex flex-1 flex-col overflow-hidden">
          {isLoadingAgents ||
          (initialAgentId && !selectedAgent && agents.length > 0) ? (
            <LoadingState label="Loading workspace agents..." />
          ) : !selectedAgent ? (
            <EmptyState
              blobatarName="OpenBots"
              title="Zero Agents Configured"
              description="Create your first autonomous agent to coordinate tools and multi-step tasks."
              actionLabel="Create Agent"
              actionIcon={<IconPlus className="size-4" />}
              onAction={openCreate}
            />
          ) : (
            <ChatPane
              key={selectedAgent.id}
              agentId={selectedAgent.id}
              agentName={selectedAgent.name}
              onOpenArtifact={openArtifact}
              onBrowserStateChange={setBrowserState}
              headerProps={headerProps}
            />
          )}
        </main>
      </SidebarInset>

      {createMounted && (
        <CreateAgentDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onAgentCreated={handleAgentCreated}
        />
      )}

      {configureMounted && (
        <ConfigureAgentSheet
          agent={selectedAgent}
          open={configureSheetOpen}
          onOpenChange={setConfigureSheetOpen}
        />
      )}

      {historyMounted && (
        <RunHistorySheet
          agentId={selectedAgentId}
          open={historySheetOpen}
          onOpenChange={setHistorySheetOpen}
          selectedRunId={inspectedRunId}
          onSelectRunId={setInspectedRunId}
        />
      )}

      {connectionsMounted && (
        <ConnectionsSheet
          open={connectionsSheetOpen}
          onOpenChange={setConnectionsSheetOpen}
        />
      )}

      {schedulesMounted && (
        <SchedulesSheet
          agentId={selectedAgentId}
          agentName={selectedAgent?.name}
          open={schedulesSheetOpen}
          onOpenChange={setSchedulesSheetOpen}
        />
      )}

      {artifactMounted && (
        <ArtifactSheet
          open={Boolean(selectedArtifact)}
          onOpenChange={handleArtifactOpenChange}
          artifact={selectedArtifact ?? lastArtifact.current}
        />
      )}
    </>
  )
}
