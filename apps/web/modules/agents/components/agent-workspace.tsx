"use client"

import { SidebarInset } from "@openbots/ui/components/sidebar"
import { IconPlus } from "@tabler/icons-react"
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
  useConversationDetailQuery,
  useConversationsQuery,
  useInfiniteConversationDetailQuery,
} from "@/modules/conversations/queries"

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
}

const ChatPane = React.memo(function ChatPane({
  agentId,
  agentName,
  onOpenArtifact,
}: ChatPaneProps) {
  const [selectedConversationId, setSelectedConversationId] = React.useState<
    string | null
  >(null)

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
    isActiveRun,
    isOptimisticRunning,
    optimisticMessages,
    setOptimisticMessages,
    sendPrompt,
    cancelActiveRun,
    isSubmitting,
    isCancelling,
  } = useAgentExecution({
    agentId,
    activeConversationId,
    onConversationCreated: setSelectedConversationId,
  })

  const isPolling =
    isOptimisticRunning ||
    activeRun?.status === "running" ||
    activeRun?.status === "queued"

  const {
    data: conversationInfiniteData,
    isLoading: isLoadingMessages,
    isFetchingNextPage: isLoadingOlder,
    hasNextPage: hasOlderMessages,
    fetchNextPage,
  } = useInfiniteConversationDetailQuery(activeConversationId, {
    refetchInterval: isPolling ? 1500 : false,
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

  const isChatLoading =
    !isOptimisticRunning &&
    optimisticMessages.length === 0 &&
    (isLoadingConversations ||
      (activeConversationId !== null && isLoadingMessages))

  const placeholder = `Send task to ${agentName}...`

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
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
      />

      <MemoComposer
        onSend={sendPrompt}
        isSubmitting={isSubmitting}
        isActiveRun={isActiveRun}
        onCancelRun={cancelActiveRun}
        isCancelling={isCancelling}
        placeholder={placeholder}
      />
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
    }
  }, [initialAgentId, agents, router])

  const openConfigure = React.useCallback(() => setConfigureSheetOpen(true), [])
  const openHistory = React.useCallback(() => {
    setInspectedRunId(null)
    setHistorySheetOpen(true)
  }, [])
  const openConnections = React.useCallback(
    () => setConnectionsSheetOpen(true),
    []
  )
  const openCreate = React.useCallback(() => setCreateDialogOpen(true), [])
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
  const artifactMounted = useMountedOnce(Boolean(selectedArtifact)) || idleReady

  return (
    <>
      <SidebarInset className="flex flex-1 flex-col overflow-hidden">
        <MemoHeader
          selectedAgent={selectedAgent}
          onOpenConfigure={openConfigure}
          onOpenHistory={openHistory}
          onOpenConnections={openConnections}
        />

        <main className="flex flex-1 flex-col overflow-hidden">
          {isLoadingAgents ? (
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
