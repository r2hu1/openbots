"use client";

import { Button } from "@openbots/ui/components/button";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@openbots/ui/components/sidebar";
import { Blobatar } from "@openbots/ui/components/ui/blobatar";
import { IconLayoutSidebarLeftExpand, IconPlus } from "@tabler/icons-react";

interface BrandRowProps {
  onOpenCreate: () => void;
  rowClass: string;
}

export function BrandRow({ onOpenCreate, rowClass }: BrandRowProps) {
  const { state, isMobile, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {collapsed ? (
          <SidebarMenuButton
            tooltip="Expand sidebar"
            onClick={toggleSidebar}
            className={rowClass}
          >
            <IconLayoutSidebarLeftExpand />
          </SidebarMenuButton>
        ) : (
          <div className="mb-px flex items-center gap-1 rounded-md">
            <Blobatar name="openbots" className="size-6!" />
            <span className="text-sm font-semibold tracking-tight">
              OpenBots
            </span>
            <Button
              size="icon-xs"
              className="ml-auto"
              variant="secondary"
              onClick={onOpenCreate}
              title="New agent"
            >
              <IconPlus />
            </Button>
          </div>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
