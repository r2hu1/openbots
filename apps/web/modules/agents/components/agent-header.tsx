"use client"

import { Badge } from "@openbots/ui/components/badge"
import { Button } from "@openbots/ui/components/button"
import { SidebarTrigger } from "@openbots/ui/components/sidebar"
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
} from "@tabler/icons-react"
import type { Agent } from "../types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openbots/ui/components/dropdown-menu"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import * as React from "react"
import { DeleteAgentDialog } from "./delete-agent-dialog"
import { RenameAgentDialog } from "./rename-agent-dialog"

interface AgentHeaderProps {
  selectedAgent: Agent | null
  onOpenConfigure: () => void
  onOpenHistory: () => void
  onOpenConnections?: () => void
  onOpenSchedules?: () => void
  onAgentRenamed?: (updatedAgent: Agent) => void
  onAgentDeleted?: (deletedId: string) => void
}

export function AgentHeader({
  selectedAgent,
  onOpenConfigure,
  onOpenHistory,
  onOpenConnections,
  onOpenSchedules,
  onAgentRenamed,
  onAgentDeleted,
}: AgentHeaderProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [renameOpen, setRenameOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  return (
    <header className="relative top-0 z-30 flex w-full shrink-0 items-center justify-between bg-background/80 p-2 backdrop-blur-xs after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-gradient-to-b after:from-background/60 after:via-background/30 after:to-transparent">
      <div className="flex items-center gap-1.5">
        <SidebarTrigger className="size-7 border-border! md:hidden" />
        {selectedAgent ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger openOnHover>
                <div className="flex cursor-pointer items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-sidebar">
                  <Blobatar
                    name={selectedAgent.name || selectedAgent.id}
                    className="size-6.5! shrink-0"
                  />
                  <div className="flex flex-col items-start leading-none">
                    <span className="text-xs font-medium text-foreground">
                      {selectedAgent.name}
                    </span>
                  </div>
                  <IconChevronDown className="ml-1 size-3.5 text-muted-foreground" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-48">
                <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                  <IconEdit className="size-4" />
                  <span>Rename Agent</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenConfigure}>
                  <IconSettings className="size-4" />
                  <span>Configure Agent</span>
                </DropdownMenuItem>
                {onOpenConnections && (
                  <DropdownMenuItem onClick={onOpenConnections}>
                    <IconPlug className="size-4" />
                    <span>Connections</span>
                  </DropdownMenuItem>
                )}
                {onOpenSchedules && (
                  <DropdownMenuItem onClick={onOpenSchedules}>
                    <IconCalendar className="size-4" />
                    <span>Schedules</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <IconTrash className="size-4" />
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
                queryClient.invalidateQueries({ queryKey: ["agent", updated.id] })
                queryClient.setQueryData(["agent", updated.id], (old: any) =>
                  old ? { ...old, agent: updated } : old
                )
                queryClient.setQueryData(["agents"], (old: any) => {
                  if (!old?.agents) return old
                  return {
                    ...old,
                    agents: old.agents.map((a: Agent) =>
                      a.id === updated.id ? { ...a, ...updated } : a
                    ),
                  }
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
                  if (!old?.agents) return old
                  return {
                    ...old,
                    agents: old.agents.filter((a: Agent) => a.id !== id),
                  }
                })
                onAgentDeleted?.(id)
                router.push("/")
              }}
            />
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {selectedAgent && (
          <>
            {onOpenConnections && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenConnections}
                className="h-7 gap-1.5 border border-border bg-sidebar text-xs"
                title="Integrations & Tools"
              >
                <IconPlug className="size-3.5" />
                <span className="hidden md:inline">Connections</span>
              </Button>
            )}

            {onOpenSchedules && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenSchedules}
                className="h-7 gap-1.5 border border-border bg-sidebar text-xs"
                title="Scheduled Autonomous Tasks"
              >
                <IconCalendar className="size-3.5" />
                <span className="hidden md:inline">Schedules</span>
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenHistory}
              className="h-7 gap-1.5 border border-border bg-sidebar text-xs"
              title="Execution History"
            >
              <IconHistory className="size-3.5" />
              <span>Runs</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenConfigure}
              className="size-7 gap-1.5 border border-border bg-sidebar text-xs"
              title="Agent Settings"
            >
              <IconSettings className="size-3.5" />
            </Button>
          </>
        )}
      </div>
    </header>
  )
}
