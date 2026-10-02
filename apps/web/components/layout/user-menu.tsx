"use client";

import { Avatar, AvatarFallback } from "@openbots/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openbots/ui/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@openbots/ui/components/sidebar";
import { IconLogout, IconSettings } from "@tabler/icons-react";

interface UserMenuProps {
  name: string;
  email?: string;
  initials: string;
  onSettings: () => void;
  onSignOut: () => void;
}

export function UserMenu({
  name,
  email,
  initials,
  onSettings,
  onSignOut,
}: UserMenuProps) {
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu className="min-w-0 flex-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:p-2">
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2">
            <Avatar className="size-8 shrink-0 group-data-[collapsible=icon]:size-7">
              <AvatarFallback className="bg-sidebar-accent text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>

            <span className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
              <span className="block truncate text-[13px] font-medium">
                {name}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {email}
              </span>
            </span>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
            className="min-w-56 rounded-xl"
          >
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Avatar className="size-8">
                <AvatarFallback className="bg-sidebar-accent text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {email}
                </p>
              </div>
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={onSettings}>
              <IconSettings />
              Settings
            </DropdownMenuItem>

            <DropdownMenuItem variant="destructive" onClick={onSignOut}>
              <IconLogout />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
