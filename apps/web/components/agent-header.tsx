"use client"

import { Badge } from "@openbots/ui/components/badge"
import { Blobatar } from "@openbots/ui/components/ui/blobatar"
import { Button } from "@openbots/ui/components/button"

import { SidebarTrigger, useSidebar } from "@openbots/ui/components/sidebar"
import {
  IconCalendar,
  IconHistory,
  IconPlug,
  IconSettings,
} from "@tabler/icons-react"
import type { AgentData } from "./configure-agent-sheet"

interface AgentHeaderProps {
  selectedAgent: AgentData | null
  onOpenConfigure: () => void
  onOpenHistory: () => void
  onOpenConnections?: () => void
  onOpenSchedules?: () => void
}

export function AgentHeader({
  selectedAgent,
  onOpenConfigure,
  onOpenHistory,
  onOpenConnections,
  onOpenSchedules,
}: AgentHeaderProps) {
  return (
    <header className="relative top-0 z-30 flex w-full shrink-0 items-center justify-between bg-background/80 p-2 backdrop-blur-xs after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-10 after:bg-gradient-to-b after:from-background after:via-background/50 after:to-transparent">
      <div className="flex items-center gap-1.5">
        <SidebarTrigger className="size-7 md:hidden" />
        {selectedAgent ? (
          <div className="flex items-center gap-px rounded-sm bg-secondary pr-1.5 pl-px">
            <Blobatar
              name={selectedAgent.name || selectedAgent.id}
              className="size-6.5! shrink-0"
            />
            <span className="text-sm font-semibold text-foreground">
              {selectedAgent.name}
            </span>
            <div className="hidden items-center gap-1.5">
              <Badge variant="secondary" className="font-mono text-[10px]">
                {selectedAgent.model.replace("google/", "")}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {selectedAgent.autonomy}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {selectedAgent.maxSteps} steps
              </Badge>
            </div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            No agent selected
          </span>
        )}
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {selectedAgent && (
          <>
            {onOpenConnections && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenConnections}
                className="h-7 gap-1.5 text-xs"
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
                className="h-7 gap-1.5 text-xs"
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
              className="h-7 gap-1.5 text-xs"
              title="Execution History"
            >
              <IconHistory className="size-3.5" />
              <span>Runs</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenConfigure}
              className="h-7 gap-1.5 text-xs"
              title="Agent Settings"
            >
              <IconSettings className="size-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </>
        )}
      </div>
    </header>
  )
}
