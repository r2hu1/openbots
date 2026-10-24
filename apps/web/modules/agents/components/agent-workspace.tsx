"use client"

import { SidebarInset } from "@openbots/ui/components/sidebar"
import { useHotkey } from "@openbots/ui/hooks/use-hotkey"
import { IconPlus } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import { EmptyState } from "@/components/shared/empty-state"
import { LoadingState } from "@/components/shared/loading-state"
import { AgentHeader } from "@/modules/agents/components/agent-header"
import { useAgentsQuery } from "@/modules/agents/queries"
import type { ParsedArtifact } from "@/modules/artifacts/parser"
import { ArtifactProvider } from "@/modules/artifacts/artifact-context"
import { ChatPane } from "./workspace/chat-pane"
import { useIdleReady, WorkspaceModals } from "./workspace/workspace-modals"

const MemoHeader = React.memo(AgentHeader)

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
  const [memorySheetOpen, setMemorySheetOpen] = React.useState(false)
  const [inspectedRunId, setInspectedRunId] = React.useState<string | null>(null)
  const [selectedArtifact, setSelectedArtifact] = React.useState<ParsedArtifact | null>(null)

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
    } else if (
      !isLoadingAgents &&
      initialAgentId &&
      agents.length > 0 &&
      !selectedAgent
    ) {
      router.replace("/")
    }
  }, [initialAgentId, agents, isLoadingAgents, selectedAgent, router])

  const openConfigure = React.useCallback(() => setConfigureSheetOpen(true), [])
  const openHistory = React.useCallback(() => {
    setInspectedRunId(null)
    setHistorySheetOpen(true)
  }, [])
  const openConnections = React.useCallback(() => setConnectionsSheetOpen(true), [])
  const openSchedules = React.useCallback(() => setSchedulesSheetOpen(true), [])
  const openMemory = React.useCallback(() => setMemorySheetOpen(true), [])
  const openCreate = React.useCallback(() => setCreateDialogOpen(true), [])
  useHotkey("mod+shift+a", openCreate)

  const openArtifact = React.useCallback((artifact: ParsedArtifact) => {
    setSelectedArtifact(artifact)
  }, [])

  const handleArtifactOpenChange = React.useCallback((open: boolean) => {
    if (!open) setSelectedArtifact(null)
  }, [])

  const handleAgentCreated = React.useCallback(
    (newId: string) => router.push(`/agent/${newId}`),
    [router]
  )

  const idleReady = useIdleReady()

  const [, setBrowserState] = React.useState<{
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
      onOpenMemory: openMemory,
    }),
    [selectedAgent, openConfigure, openHistory, openConnections, openSchedules, openMemory]
  )

  return (
    <ArtifactProvider
      selectedArtifact={selectedArtifact}
      onOpenArtifact={openArtifact}
      onCloseArtifact={() => setSelectedArtifact(null)}
    >
      <SidebarInset className="flex flex-1 flex-col overflow-hidden">
        {!selectedAgent && (
          <MemoHeader
            selectedAgent={null}
            onOpenConfigure={openConfigure}
            onOpenHistory={openHistory}
            onOpenConnections={openConnections}
            onOpenSchedules={openSchedules}
            onOpenMemory={openMemory}
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
              title="Zero Agents Yet"
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

      <WorkspaceModals
        selectedAgent={selectedAgent}
        selectedAgentId={selectedAgentId}
        createDialogOpen={createDialogOpen}
        setCreateDialogOpen={setCreateDialogOpen}
        handleAgentCreated={handleAgentCreated}
        configureSheetOpen={configureSheetOpen}
        setConfigureSheetOpen={setConfigureSheetOpen}
        historySheetOpen={historySheetOpen}
        setHistorySheetOpen={setHistorySheetOpen}
        inspectedRunId={inspectedRunId}
        setInspectedRunId={setInspectedRunId}
        connectionsSheetOpen={connectionsSheetOpen}
        setConnectionsSheetOpen={setConnectionsSheetOpen}
        schedulesSheetOpen={schedulesSheetOpen}
        setSchedulesSheetOpen={setSchedulesSheetOpen}
        selectedArtifact={selectedArtifact}
        lastArtifact={lastArtifact.current}
        handleArtifactOpenChange={handleArtifactOpenChange}
        idleReady={idleReady}
      />
    </ArtifactProvider>
  )
}
