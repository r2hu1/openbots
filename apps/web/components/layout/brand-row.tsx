"use client"

import { Button } from "@openbots/ui/components/button"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@openbots/ui/components/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openbots/ui/components/tooltip"
import { Blobatar } from "@openbots/ui/components/ui/blobatar"
import { IconLayoutSidebarLeftExpand, IconPlus } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

interface BrandRowProps {
  onOpenCreate: () => void
  rowClass: string
}

export function BrandRow({ onOpenCreate, rowClass }: BrandRowProps) {
  const { state, toggleSidebar } = useSidebar()
  const collapsed = state === "collapsed"

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {collapsed ? (
          <>
            <SidebarMenuButton
              tooltip="Expand sidebar"
              onClick={toggleSidebar}
              className={cn(rowClass, "bg-sidebar-accent p-0")}
            >
              <IconLayoutSidebarLeftExpand />
            </SidebarMenuButton>
            <SidebarMenuButton
              tooltip="Add agent"
              onClick={onOpenCreate}
              className={cn(rowClass, "mt-2 bg-sidebar-accent p-0")}
            >
              <IconPlus />
            </SidebarMenuButton>
          </>
        ) : (
          <div className="mb-px flex items-center gap-1 rounded-md">
            <Blobatar name="openbots" className="size-6!" />
            <span className="text-sm font-semibold tracking-tight">
              OpenBots
            </span>
            <Tooltip>
              <TooltipTrigger render={<div />} className="ml-auto">
                <Button
                  size="icon-xs"
                  variant="secondary"
                  onClick={onOpenCreate}
                  title="New agent"
                >
                  <IconPlus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Create new agent</TooltipContent>
            </Tooltip>
          </div>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
