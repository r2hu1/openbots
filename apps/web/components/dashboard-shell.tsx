"use client";

import { SidebarProvider } from "@openbots/ui/components/sidebar";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";
import { AuthGuard } from "@/components/auth-guard";
import type { AgentData } from "@/components/configure-agent-sheet";
import { CreateAgentDialog } from "@/components/create-agent-dialog";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { getClient } from "@/lib/api";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);

  const { data: agentsData } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const client = getClient();
      const res = await client.api.agents.$get();
      if (!res.ok) throw new Error("Failed to fetch agents");
      return res.json() as Promise<{ agents: AgentData[] }>;
    },
  });

  const agents = agentsData?.agents || [];

  return (
    <AuthGuard>
      <SidebarProvider defaultOpen>
        <div className="flex h-svh w-full overflow-hidden bg-background">
          <WorkspaceSidebar
            agents={agents}
            onOpenCreate={() => setCreateDialogOpen(true)}
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
