"use client"

import { SidebarInset, SidebarProvider } from "@openbots/ui/components/sidebar"
import { useRouter } from "next/navigation"
import * as React from "react"
import { AuthGuard } from "@/components/shared/auth-guard"
import { CreateAgentDialog } from "@/modules/agents/components/create-agent-dialog"
import { useAgentsQuery } from "@/modules/agents/queries"
import { ConnectionsSheet } from "@/modules/connections/components/connections-sheet"
import { WorkspaceSidebar } from "./workspace-sidebar"

interface DashboardShellProps {
  children: React.ReactNode
  defaultOpen?: boolean
}

export function DashboardShell({
  children,
  defaultOpen = true,
}: DashboardShellProps) {
  const router = useRouter()
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [connectionsOpen, setConnectionsOpen] = React.useState(false)

  const { data: agents = [], isPending: agentsPending } = useAgentsQuery()

  return (
    <AuthGuard>
      <SidebarProvider defaultOpen={defaultOpen}>
        <WorkspaceSidebar
          agents={agents}
          onOpenCreate={() => setCreateDialogOpen(true)}
          onOpenConnections={() => setConnectionsOpen(true)}
          agentsPending={agentsPending}
        />
        <div className="flex h-svh w-full overflow-hidden bg-background">
          {children}

          <CreateAgentDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            onAgentCreated={(newId) => {
              router.push(`/agent/${newId}`)
            }}
          />
        </div>

        <ConnectionsSheet
          open={connectionsOpen}
          onOpenChange={setConnectionsOpen}
        />
      </SidebarProvider>
    </AuthGuard>
  )
}
