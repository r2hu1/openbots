"use client"

import dynamic from "next/dynamic"
import * as React from "react"
import type { ParsedArtifact } from "@/modules/artifacts/parser"

const ConfigureAgentSheet = dynamic(
  () => import("@/modules/agents/components/configure-agent-sheet").then((m) => m.ConfigureAgentSheet),
  { ssr: false }
)
const CreateAgentDialog = dynamic(
  () => import("@/modules/agents/components/create-agent-dialog").then((m) => m.CreateAgentDialog),
  { ssr: false }
)
const ArtifactSheet = dynamic(
  () => import("@/modules/artifacts/artifact-sheet").then((m) => m.ArtifactSheet),
  { ssr: false }
)
const ConnectionsSheet = dynamic(
  () => import("@/modules/connections/components/connections-sheet").then((m) => m.ConnectionsSheet),
  { ssr: false }
)
const RunHistorySheet = dynamic(
  () => import("@/modules/runs/components/run-history-sheet").then((m) => m.RunHistorySheet),
  { ssr: false }
)
const SchedulesSheet = dynamic(
  () => import("@/modules/schedules/components/schedules-sheet").then((m) => m.SchedulesSheet),
  { ssr: false }
)
const AgentMemorySheet = dynamic(
  () => import("@/modules/agents/components/agent-memory-sheet").then((m) => m.AgentMemorySheet),
  { ssr: false }
)

export function useIdleReady() {
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => setReady(true), { timeout: 2000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(() => setReady(true), 200)
    return () => window.clearTimeout(id)
  }, [])

  return ready
}

export function useMountedOnce(open: boolean) {
  const mounted = React.useRef(false)
  if (open) mounted.current = true
  return mounted.current
}

interface WorkspaceModalsProps {
  selectedAgent: any
  selectedAgentId: string | null
  createDialogOpen: boolean
  setCreateDialogOpen: (open: boolean) => void
  handleAgentCreated: (newId: string) => void
  configureSheetOpen: boolean
  setConfigureSheetOpen: (open: boolean) => void
  historySheetOpen: boolean
  setHistorySheetOpen: (open: boolean) => void
  inspectedRunId: string | null
  setInspectedRunId: (runId: string | null) => void
  connectionsSheetOpen: boolean
  setConnectionsSheetOpen: (open: boolean) => void
  schedulesSheetOpen: boolean
  setSchedulesSheetOpen: (open: boolean) => void
  memorySheetOpen: boolean
  setMemorySheetOpen: (open: boolean) => void
  selectedArtifact: ParsedArtifact | null
  lastArtifact: ParsedArtifact | null
  handleArtifactOpenChange: (open: boolean) => void
  idleReady: boolean
}

export function WorkspaceModals({
  selectedAgent,
  selectedAgentId,
  createDialogOpen,
  setCreateDialogOpen,
  handleAgentCreated,
  configureSheetOpen,
  setConfigureSheetOpen,
  historySheetOpen,
  setHistorySheetOpen,
  inspectedRunId,
  setInspectedRunId,
  connectionsSheetOpen,
  setConnectionsSheetOpen,
  schedulesSheetOpen,
  setSchedulesSheetOpen,
  memorySheetOpen,
  setMemorySheetOpen,
  selectedArtifact,
  lastArtifact,
  handleArtifactOpenChange,
  idleReady,
}: WorkspaceModalsProps) {
  const createMounted = useMountedOnce(createDialogOpen) || idleReady
  const configureMounted = useMountedOnce(configureSheetOpen) || idleReady
  const historyMounted = useMountedOnce(historySheetOpen) || idleReady
  const connectionsMounted = useMountedOnce(connectionsSheetOpen) || idleReady
  const schedulesMounted = useMountedOnce(schedulesSheetOpen) || idleReady
  const memoryMounted = useMountedOnce(memorySheetOpen) || idleReady
  const artifactMounted = useMountedOnce(Boolean(selectedArtifact)) || idleReady

  return (
    <>
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

      {memoryMounted && (
        <AgentMemorySheet
          agentId={selectedAgentId}
          agentName={selectedAgent?.name}
          open={memorySheetOpen}
          onOpenChange={setMemorySheetOpen}
        />
      )}

      {artifactMounted && (
        <ArtifactSheet
          open={Boolean(selectedArtifact)}
          onOpenChange={handleArtifactOpenChange}
          artifact={selectedArtifact ?? lastArtifact}
        />
      )}
    </>
  )
}
