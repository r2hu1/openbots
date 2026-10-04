"use client"

import { Button } from "@openbots/ui/components/button"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
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
import { Kbd } from "@openbots/ui/components/kbd"
import { Plus, SidebarRight2 } from "reicon-react"

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
              className={cn(rowClass, "bg-secondary p-0")}
            >
              <SidebarRight2 />
            </SidebarMenuButton>
            <SidebarMenuButton
              tooltip="Add agent"
              onClick={onOpenCreate}
              className={cn(rowClass, "mt-2 p-0")}
            >
              <Plus />
            </SidebarMenuButton>
          </>
        ) : (
          <div className="mb-px space-y-3">
            <div className="flex items-center gap-1">
              <SidebarTrigger
                size="icon-sm"
                className="size-7 rounded-lg p-0 text-sidebar-accent-foreground/50"
              />
              <span className="font-medium tracking-tight">OpenBots</span>
            </div>
            <div className="space-y-2">
              <Button
                size="sm"
                variant="ghost"
                className="group/btn w-full justify-normal px-2 pl-0.5 text-left text-sm font-normal text-sidebar-accent-foreground/80"
                onClick={onOpenCreate}
              >
                <div className="mr-1 flex size-5.5 items-center justify-center rounded-full bg-sidebar-accent">
                  <Plus />
                </div>
                New Agent
                <Kbd className="ml-auto hidden group-hover/btn:flex">⌘⇧A</Kbd>
              </Button>
            </div>
          </div>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
