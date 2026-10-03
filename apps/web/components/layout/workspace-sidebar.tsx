"use client"

import { Button } from "@openbots/ui/components/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@openbots/ui/components/input-group"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@openbots/ui/components/sidebar"
import { Blobatar } from "@openbots/ui/components/ui/blobatar"
import { cn } from "@openbots/ui/lib/utils"
import { IconPlus, IconSearch } from "@tabler/icons-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import * as React from "react"
import { signOut, useSession } from "@/lib/auth-client"
import type { Agent } from "@/modules/agents/types"
import { ConnectionsSheet } from "@/modules/connections/components/connections-sheet"
import { BrandRow } from "./brand-row"
import { UserMenu } from "./user-menu"

interface WorkspaceSidebarProps {
  agents: Agent[]
  onOpenCreate: () => void
  onOpenConnections?: () => void
}

const rowClass =
  "rounded-xl text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"

export function WorkspaceSidebar({
  agents,
  onOpenCreate,
  onOpenConnections,
}: WorkspaceSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const [search, setSearch] = React.useState("")
  const [internalConnectionsOpen, setInternalConnectionsOpen] =
    React.useState(false)

  const filteredAgents = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return agents

    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) ||
        agent.description?.toLowerCase().includes(query)
    )
  }, [agents, search])

  const handleSignOut = async () => {
    await signOut()
    router.replace("/login")
  }

  const handleOpenConnections = () => {
    if (onOpenConnections) {
      onOpenConnections()
    } else {
      setInternalConnectionsOpen(true)
    }
  }

  const userInitials = React.useMemo(() => {
    const name = session?.user?.name || session?.user?.email || "U"
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
  }, [session])

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="px-3 group-data-[collapsible=icon]:px-2">
          <BrandRow onOpenCreate={onOpenCreate} rowClass={rowClass} />

          <InputGroup className="mt-1 h-8 border border-border bg-background shadow-none group-data-[collapsible=icon]:hidden">
            <InputGroupAddon>
              <IconSearch />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search agents"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </InputGroup>
        </SidebarHeader>

        <SidebarContent className="px-1 group-data-[collapsible=icon]:px-0">
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px]">
              My Agents
            </SidebarGroupLabel>
            <SidebarGroupContent>
              {filteredAgents.length === 0 ? (
                <p className="flex flex-col gap-2 rounded-md border px-3 py-6 text-center text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                  {search
                    ? "No agents match your search"
                    : "No agents created yet"}
                  <Button
                    size="xs"
                    className="mx-auto w-fit"
                    onClick={onOpenCreate}
                  >
                    Create Agent <IconPlus />
                  </Button>
                </p>
              ) : (
                <SidebarMenu className="gap-0.5 gap-2">
                  {filteredAgents.map((agent) => {
                    const isActive = pathname === `/agent/${agent.id}`

                    return (
                      <SidebarMenuItem key={agent.id}>
                        <SidebarMenuButton
                          render={<Link href={`/agent/${agent.id}`} />}
                          isActive={isActive}
                          tooltip={agent.name}
                          className={cn(
                            rowClass,
                            "h-11 rounded-md group-data-[collapsible=icon]:p-0!"
                          )}
                        >
                          <span className="relative flex shrink-0 group-data-[collapsible=icon]:mx-auto">
                            <Blobatar
                              name={agent.name || agent.id}
                              className="size-7! group-data-[collapsible=icon]:size-6"
                              blobatar={{
                                animate: isActive ? "always" : "hover",
                              }}
                            />
                          </span>

                          <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                            <span className="block truncate text-[13px] font-medium">
                              {agent.name}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {agent.description ?? agent.model}
                            </span>
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="flex items-center group-data-[collapsible=icon]:flex-col">
            <UserMenu
              name={session?.user?.name || "User"}
              email={session?.user?.email}
              initials={userInitials}
              onSettings={() => router.push("/settings")}
              onConnections={handleOpenConnections}
              onSignOut={handleSignOut}
            />

            <SidebarTrigger className="size-8 group-data-[collapsible=icon]:hidden" />
          </div>
        </SidebarFooter>
      </Sidebar>

      <ConnectionsSheet
        open={internalConnectionsOpen}
        onOpenChange={setInternalConnectionsOpen}
      />
    </>
  )
}
