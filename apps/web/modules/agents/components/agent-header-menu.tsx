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
import { ChevronDown, Edit, Plug2, Setting, Sparkle, Trash2 } from "reicon-react"
import type { Agent } from "../types"
import { DeleteAgentDialog } from "./delete-agent-dialog"
import { RenameAgentDialog } from "./rename-agent-dialog"

interface AgentHeaderMenuProps {
  selectedAgent: Agent
  onOpenConfigure: () => void
  onOpenConnections?: () => void
  onOpenMemory?: () => void
  onAgentRenamed?: (updatedAgent: Agent) => void
  onAgentDeleted?: (deletedId: string) => void
}

export function AgentHeaderMenu({
  selectedAgent,
  onOpenConfigure,
  onOpenConnections,
  onOpenMemory,
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
          <div className="flex cursor-pointer items-center">
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
            <ChevronDown className="ml-2 size-3 text-muted-foreground" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-fit max-w-xs min-w-48">
          <div className="space-y-px p-1 pt-0.5">
            <p className="text-sm font-medium">{selectedAgent.name}</p>
            <p className="text-xs font-normal text-foreground/90">
              {selectedAgent.description}
            </p>
          </div>
          <DropdownMenuSeparator />
          <p className="p-1 text-xs font-normal text-foreground/90">
            {selectedAgent.model}
          </p>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setRenameOpen(true)}>
            <span>Rename Agent</span>
            <Edit className="ml-auto size-3.5" />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenConfigure}>
            <span>Configure Agent</span>
            <Setting className="ml-auto size-3.5" />
          </DropdownMenuItem>
          {onOpenMemory && (
            <DropdownMenuItem onClick={onOpenMemory}>
              <span>Memory</span>
              <Sparkle className="ml-auto size-3.5" />
            </DropdownMenuItem>
          )}
          {onOpenConnections && (
            <DropdownMenuItem onClick={onOpenConnections}>
              <span>Connections</span>
              <Plug2 className="ml-auto size-3.5" />
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
