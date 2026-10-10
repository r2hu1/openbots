"use client"

import { Badge } from "@openbots/ui/components/badge"
import { Button } from "@openbots/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openbots/ui/components/dropdown-menu"
import { SidebarTrigger, useSidebar } from "@openbots/ui/components/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openbots/ui/components/tooltip"
import { Blobatar } from "@openbots/ui/components/ui/blobatar"
import {
  IconCalendar,
  IconChevronDown,
  IconEdit,
  IconHistory,
  IconPlug,
  IconSettings,
  IconTrash,
  IconWorld,
} from "@tabler/icons-react"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import * as React from "react"
import {
  Calendar2Newicons,
  ChevronDown,
  Display,
  Edit,
  History2,
  Plug2,
  Setting,
  Trash2,
} from "reicon-react"
import { cn } from "@/lib/utils"
import type { Agent } from "../types"
import { DeleteAgentDialog } from "./delete-agent-dialog"
import { RenameAgentDialog } from "./rename-agent-dialog"
import { useIsMobile } from "@openbots/ui/hooks/use-mobile"

interface AgentHeaderProps {
  selectedAgent: Agent | null
  onOpenConfigure: () => void
  onOpenHistory: () => void
  onOpenConnections?: () => void
  onOpenSchedules?: () => void
  onAgentRenamed?: (updatedAgent: Agent) => void
  onAgentDeleted?: (deletedId: string) => void
  isBrowserActive?: boolean
  isBrowserOpen?: boolean
  onToggleBrowser?: () => void
}

export function AgentHeader({
  selectedAgent,
  onOpenConfigure,
  onOpenHistory,
  onOpenConnections,
  onOpenSchedules,
  onAgentRenamed,
  onAgentDeleted,
  isBrowserActive,
  isBrowserOpen,
  onToggleBrowser,
}: AgentHeaderProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [renameOpen, setRenameOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const { open } = useSidebar()
  const isMobile = useIsMobile()

  return (
    <header
      className={cn(
        "fixed top-0 right-0 left-0 z-50 flex items-center justify-between bg-background px-3 pt-2 pb-1 transition-[left] duration-200",
        "after:pointer-events-none after:absolute after:top-full after:right-0 after:left-0 after:h-6 after:bg-linear-to-b after:from-background after:to-transparent",
        !isMobile && open && "left-[var(--sidebar-width)]",
        !isMobile && !open && "left-[var(--sidebar-width-icon)]"
      )}
    >
      <div className="flex items-center gap-1.5">
        {isMobile && (
          <SidebarTrigger className="flex cursor-pointer items-center gap-1.5 rounded-full border-0! bg-secondary/80 text-xs font-medium text-foreground backdrop-blur-sm transition-colors" />
        )}
        {selectedAgent ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger openOnHover>
                <div className="flex cursor-pointer items-center rounded-full bg-secondary/80 py-0.5 pr-1.5 pl-1 backdrop-blur-sm transition-colors">
                  <Blobatar
                    name={selectedAgent.name || selectedAgent.id}
                    className="size-6.5!"
                    blobatar={{
                      animate: "always",
                    }}
                  />
                  <div className="ml-0.5 flex flex-col items-start leading-none">
                    <span className="text-xs font-medium text-foreground">
                      {selectedAgent.name}
                    </span>
                  </div>
                  <ChevronDown className="ml-1.5 size-3 text-muted-foreground" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-48">
                <div className="space-y-px p-1 pt-0.5">
                  <p className="text-sm font-medium">{selectedAgent.name}</p>
                  <p className="text-xs font-normal text-foreground/90">
                    {selectedAgent.description}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                  <Edit className="size-4" />
                  <span>Rename Agent</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenConfigure}>
                  <Setting className="size-4" />
                  <span>Configure Agent</span>
                </DropdownMenuItem>
                {onOpenConnections && (
                  <DropdownMenuItem onClick={onOpenConnections}>
                    <Plug2 className="size-4" />
                    <span>Connections</span>
                  </DropdownMenuItem>
                )}
                {onOpenSchedules && (
                  <DropdownMenuItem onClick={onOpenSchedules}>
                    <Calendar2Newicons className="size-4" />
                    <span>Schedules</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-4" />
                  <span>Delete Agent</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <RenameAgentDialog
              agent={selectedAgent}
              open={renameOpen}
              onOpenChange={setRenameOpen}
              onSuccess={(updated) => {
                queryClient.invalidateQueries({ queryKey: ["agents"] })
                queryClient.invalidateQueries({
                  queryKey: ["agent", updated.id],
                })
                queryClient.setQueryData(["agent", updated.id], (old: any) =>
                  old ? { ...old, agent: updated } : old
                )
                queryClient.setQueryData(["agents"], (old: any) => {
                  if (Array.isArray(old)) {
                    return old.map((a: Agent) =>
                      a.id === updated.id ? { ...a, ...updated } : a
                    )
                  }
                  if (old?.agents) {
                    return {
                      ...old,
                      agents: old.agents.map((a: Agent) =>
                        a.id === updated.id ? { ...a, ...updated } : a
                      ),
                    }
                  }
                  return old
                })
                onAgentRenamed?.(updated)
              }}
            />

            <DeleteAgentDialog
              agent={selectedAgent}
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              onSuccess={(id) => {
                queryClient.invalidateQueries({ queryKey: ["agents"] })
                queryClient.removeQueries({ queryKey: ["agent", id] })
                queryClient.setQueryData(["agents"], (old: any) => {
                  if (Array.isArray(old)) {
                    return old.filter((a: Agent) => a.id !== id)
                  }
                  if (old?.agents) {
                    return {
                      ...old,
                      agents: old.agents.filter((a: Agent) => a.id !== id),
                    }
                  }
                  return old
                })
                onAgentDeleted?.(id)
              }}
            />
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {selectedAgent && (
          <>
            {isBrowserActive && onToggleBrowser && (
              <Button
                variant={isBrowserOpen ? "default" : "secondary"}
                size="sm"
                onClick={onToggleBrowser}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-full border-0! text-xs font-medium backdrop-blur-sm transition-all",
                  isBrowserOpen
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-secondary/80 text-foreground hover:bg-secondary"
                )}
                title={
                  isBrowserOpen
                    ? "Hide Live Cloud Browser"
                    : "Show Live Cloud Browser"
                }
              >
                <Display className="size-3.5" />
                <span className="hidden sm:inline">Desktop</span>
              </Button>
            )}

            {onOpenSchedules && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenSchedules}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border-0! bg-secondary/80 text-xs font-medium text-foreground backdrop-blur-sm transition-colors"
                title="Scheduled Autonomous Tasks"
              >
                <Calendar2Newicons className="size-4" />
                <span className="hidden md:inline">Schedules</span>
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenHistory}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border-0! bg-secondary/80 text-xs font-medium text-foreground backdrop-blur-sm transition-colors"
              title="Execution History"
            >
              <History2 className="size-4" />
              <span className="hidden sm:flex">Runs</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenConfigure}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border-0! bg-secondary/80 text-xs font-medium text-foreground backdrop-blur-sm transition-colors"
              title="Agent Settings"
            >
              <Setting className="size-4" />
            </Button>
          </>
        )}
      </div>
    </header>
  )
}
