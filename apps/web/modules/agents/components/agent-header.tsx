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
} from "@tabler/icons-react"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import * as React from "react"
import {
  Calendar2Newicons,
  ChevronDown,
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
  const { open } = useSidebar()

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-50 flex items-center justify-between p-2 px-3 transition-[left] duration-200",
        open && "md:left-[var(--sidebar-width)]",
        !open && "left-[var(--sidebar-width-icon)]"
      )}
    >
      <div className="flex items-center gap-1.5">
        {selectedAgent ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger openOnHover>
                <div className="flex cursor-pointer items-center rounded-md bg-secondary px-1 pr-1.5 pl-0.5 transition-colors">
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
            {onOpenSchedules && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenSchedules}
                className="h-7 gap-1.5 bg-secondary text-xs"
                title="Scheduled Autonomous Tasks"
              >
                <Calendar2Newicons className="size-3.5" />
                <span className="hidden md:inline">Schedules</span>
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenHistory}
              className="h-7 gap-1.5 bg-secondary text-xs"
              title="Execution History"
            >
              <History2 className="size-3.5" />
              <span>Runs</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenConfigure}
              className="size-7 gap-1.5 bg-secondary text-xs"
              title="Agent Settings"
            >
              <Setting className="size-3.5" />
            </Button>
          </>
        )}
      </div>
    </header>
  )
}
