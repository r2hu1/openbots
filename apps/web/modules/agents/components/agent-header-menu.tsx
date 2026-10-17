"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Blobatar } from "@openbots/ui/components/ui/blobatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openbots/ui/components/dropdown-menu"
import { ChevronDown, Edit, Plug2, Setting, Trash2 } from "reicon-react"
import type { Agent } from "../types"
import { DeleteAgentDialog } from "./delete-agent-dialog"
import { RenameAgentDialog } from "./rename-agent-dialog"

interface AgentHeaderMenuProps {
  selectedAgent: Agent
  onOpenConfigure: () => void
  onOpenConnections?: () => void
  onAgentRenamed?: (updatedAgent: Agent) => void
  onAgentDeleted?: (deletedId: string) => void
}

export function AgentHeaderMenu({
  selectedAgent,
  onOpenConfigure,
  onOpenConnections,
  onAgentRenamed,
  onAgentDeleted,
}: AgentHeaderMenuProps) {
  const queryClient = useQueryClient()
  const [renameOpen, setRenameOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger openOnHover>
          <div className="flex cursor-pointer items-center rounded-full bg-secondary py-0.5 pr-1.5 pl-1 backdrop-blur-sm transition-colors">
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
  )
}
