"use client"

import { Button } from "@openbots/ui/components/button"
import { Kbd } from "@openbots/ui/components/kbd"
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
import { Plus, SidebarRight2 } from "reicon-react"
import { cn } from "@/lib/utils"
import { useShortcutLabel } from "@openbots/ui/hooks/use-hotkey"

interface BrandRowProps {
  onOpenCreate: () => void
  rowClass: string
}

export function BrandRow({ onOpenCreate, rowClass }: BrandRowProps) {
  const { state, toggleSidebar } = useSidebar()
  const collapsed = state === "collapsed"
  const shortcut = useShortcutLabel("mod+shift+a")

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {collapsed ? (
          <div className="flex flex-col gap-2">
            <SidebarMenuButton
              tooltip="Expand sidebar"
              onClick={toggleSidebar}
              className={cn(rowClass, "bg-secondary p-0")}
            >
              <SidebarRight2 />
            </SidebarMenuButton>
            <SidebarMenuButton
              tooltip="New agent"
              onClick={onOpenCreate}
              className={cn(rowClass, "p-0")}
            >
              <Plus />
            </SidebarMenuButton>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <SidebarTrigger
              size="icon-sm"
              className="size-7 shrink-0 rounded-lg p-0 text-sidebar-accent-foreground/50"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium tracking-tight">
              OpenBots
            </span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onOpenCreate}
                    aria-label="New agent"
                    className="size-7 shrink-0 rounded-lg text-sidebar-accent-foreground/60 hover:text-sidebar-accent-foreground"
                  >
                    <Plus />
                  </Button>
                }
              />
              <TooltipContent side="right" className="flex items-center gap-2">
                New agent
                <Kbd>{shortcut}</Kbd>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
