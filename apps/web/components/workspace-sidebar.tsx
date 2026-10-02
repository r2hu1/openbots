"use client"

import { Avatar, AvatarFallback } from "@openbots/ui/components/avatar"
import { Blobatar } from "@openbots/ui/components/ui/blobatar"
import { Button } from "@openbots/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openbots/ui/components/dropdown-menu"
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
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@openbots/ui/components/sidebar"
import { cn } from "@openbots/ui/lib/utils"
import {
  IconLayoutSidebarLeftExpand,
  IconLogout,
  IconPlus,
  IconSearch,
  IconSettings,
} from "@tabler/icons-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import * as React from "react"
import type { AgentData } from "@/components/configure-agent-sheet"
import { signOut, useSession } from "@/lib/auth-client"

interface WorkspaceSidebarProps {
  agents: AgentData[]
  onOpenCreate: () => void
}

const rowClass =
  "rounded-xl text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"

function BrandRow({ onClickButton }: { onClickButton: () => void }) {
  const { state, isMobile, toggleSidebar } = useSidebar()
  const collapsed = state === "collapsed" && !isMobile

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {collapsed ? (
          // Collapsed: single button that expands the sidebar
          <SidebarMenuButton
            tooltip="Expand sidebar"
            onClick={toggleSidebar}
            className={rowClass}
          >
            <IconLayoutSidebarLeftExpand />
          </SidebarMenuButton>
        ) : (
          // Expanded: logo + wordmark, new agent button on the right
          <div className="mb-px flex items-center gap-1 rounded-md">
            <Blobatar name="openbots" className="size-6!" />
            <span className="text-sm font-semibold tracking-tight">
              OpenBots
            </span>
            <Button
              size="icon-xs"
              className="ml-auto"
              variant="secondary"
              onClick={onClickButton}
              title="New agent"
            >
              <IconPlus />
            </Button>
          </div>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function UserMenu({
  name,
  email,
  initials,
  onSettings,
  onSignOut,
}: {
  name: string
  email?: string
  initials: string
  onSettings: () => void
  onSignOut: () => void
}) {
  const { isMobile } = useSidebar()

  return (
    <SidebarMenu className="min-w-0 flex-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:p-2">
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2">
            <Avatar className="size-8 shrink-0 group-data-[collapsible=icon]:size-7">
              <AvatarFallback className="bg-sidebar-accent text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>

            <span className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
              <span className="block truncate text-[13px] font-medium">
                {name}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {email}
              </span>
            </span>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
            className="min-w-56 rounded-xl"
          >
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Avatar className="size-8">
                <AvatarFallback className="bg-sidebar-accent text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {email}
                </p>
              </div>
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={onSettings}>
              <IconSettings />
              Settings
            </DropdownMenuItem>

            <DropdownMenuItem variant="destructive" onClick={onSignOut}>
              <IconLogout />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function WorkspaceSidebar({
  agents,
  onOpenCreate,
}: WorkspaceSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const [search, setSearch] = React.useState("")

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
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader className="px-3 group-data-[collapsible=icon]:px-2">
        <BrandRow onClickButton={onOpenCreate} />

        <InputGroup className="h-8 border border-border/40 bg-accent shadow-none group-data-[collapsible=icon]:hidden">
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
                  const isOnline = agent.status === "active"

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
                        {/* Avatar + status dot (dot sits on the avatar when collapsed) */}
                        <span className="relative flex shrink-0 group-data-[collapsible=icon]:mx-auto">
                          <Blobatar
                            name={agent.name || agent.id}
                            className="size-7 group-data-[collapsible=icon]:size-6"
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
            onSignOut={handleSignOut}
          />

          <SidebarTrigger className="size-8 shrink-0 text-muted-foreground hover:text-foreground" />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
