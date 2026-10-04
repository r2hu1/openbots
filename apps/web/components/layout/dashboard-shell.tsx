"use client";

import { SidebarInset, SidebarProvider } from "@openbots/ui/components/sidebar";
import { useRouter } from "next/navigation";
import * as React from "react";
import { AuthGuard } from "@/components/shared/auth-guard";
import { CreateAgentDialog } from "@/modules/agents/components/create-agent-dialog";
import { useAgentsQuery } from "@/modules/agents/queries";
import { ConnectionsSheet } from "@/modules/connections/components/connections-sheet";
import { SearchCommandDialog } from "./search-command-dialog";
import { SettingsSheet } from "./settings-sheet";
import { WorkspaceSidebar } from "./workspace-sidebar";

interface DashboardShellProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function DashboardShell({
  children,
  defaultOpen = true,
}: DashboardShellProps) {
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [connectionsOpen, setConnectionsOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  const { data: agents = [], isPending: agentsPending } = useAgentsQuery();

  // Register global Cmd+K / Ctrl+K keyboard shortcut
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <AuthGuard>
      <SidebarProvider defaultOpen={defaultOpen}>
        <WorkspaceSidebar
          agents={agents}
          onOpenCreate={() => setCreateDialogOpen(true)}
          onOpenConnections={() => setConnectionsOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          agentsPending={agentsPending}
        />
        <div className="flex h-svh w-full overflow-hidden bg-background">
          {children}

          <CreateAgentDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            onAgentCreated={(newId) => {
              router.push(`/agent/${newId}`);
            }}
          />
        </div>

        <SearchCommandDialog
          open={searchOpen}
          onOpenChange={setSearchOpen}
          agents={agents}
          onOpenCreateAgent={() => setCreateDialogOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenConnections={() => setConnectionsOpen(true)}
        />

        <ConnectionsSheet
          open={connectionsOpen}
          onOpenChange={setConnectionsOpen}
        />

        <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      </SidebarProvider>
    </AuthGuard>
  );
}
