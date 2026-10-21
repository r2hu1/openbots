"use client"

import { Button } from "@openbots/ui/components/button"
import { ButtonGroup } from "@openbots/ui/components/button-group"
import { SidebarTrigger } from "@openbots/ui/components/sidebar"
import { useIsMobile } from "@openbots/ui/hooks/use-mobile"
import * as React from "react"
import { Calendar2Newicons, Display, History2 } from "reicon-react"
import { cn } from "@/lib/utils"
import type { Agent } from "../types"
import { AgentHeaderMenu } from "./agent-header-menu"

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
  className?: string
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
  className,
}: AgentHeaderProps) {
  const isMobile = useIsMobile()

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex w-full shrink-0 items-center justify-between bg-background/5 px-3 pt-2 pb-0",
        "after:pointer-events-none after:absolute after:top-full after:right-0 after:left-0 after:h-6 after:bg-linear-to-b after:from-background after:to-transparent",
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        {isMobile && (
          <SidebarTrigger className="flex cursor-pointer items-center gap-1.5 rounded-full border-0! bg-secondary text-xs font-medium text-foreground backdrop-blur-sm transition-colors" />
        )}
        {selectedAgent && (
          <AgentHeaderMenu
            selectedAgent={selectedAgent}
            onOpenConfigure={onOpenConfigure}
            onOpenConnections={onOpenConnections}
            onAgentRenamed={onAgentRenamed}
            onAgentDeleted={onAgentDeleted}
          />
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {selectedAgent && (
          <ButtonGroup className="rounded-full">
            {isBrowserActive && onToggleBrowser && (
              <Button
                variant={isBrowserOpen ? "default" : "secondary"}
                size="sm"
                onClick={onToggleBrowser}
                className="cursor-pointer gap-1.5 text-xs font-medium backdrop-blur-sm transition-all"
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
                className="cursor-pointer gap-1.5 bg-secondary text-xs font-medium text-foreground backdrop-blur-sm"
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
              className="cursor-pointer gap-1.5 bg-secondary text-xs font-medium text-foreground backdrop-blur-sm"
              title="Execution History"
            >
              <History2 className="size-4" />
            </Button>
          </ButtonGroup>
        )}
      </div>
    </header>
  )
}
