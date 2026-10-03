"use client";

import { SidebarProvider } from "@openbots/ui/components/sidebar";
import { useRouter } from "next/navigation";
import * as React from "react";
import { AuthGuard } from "@/components/shared/auth-guard";
import { CreateAgentDialog } from "@/modules/agents/components/create-agent-dialog";
import { useAgentsQuery } from "@/modules/agents/queries";
import { WorkspaceSidebar } from "./workspace-sidebar";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);

  const { data: agents = [], isPending: agentsPending } = useAgentsQuery();

  return (
    <AuthGuard>
      <SidebarProvider defaultOpen>
        <div className="flex h-svh w-full overflow-hidden bg-background">
          <WorkspaceSidebar
            agents={agents}
            onOpenCreate={() => setCreateDialogOpen(true)}
            agentsPending={agentsPending}
          />

          {children}

          <CreateAgentDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            onAgentCreated={(newId) => {
              router.push(`/agent/${newId}`);
            }}
          />
        </div>
      </SidebarProvider>
    </AuthGuard>
  );
}
