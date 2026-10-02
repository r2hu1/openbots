"use client";

import { Avatar, AvatarFallback } from "@openbots/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@openbots/ui/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@openbots/ui/components/sidebar";
import {
  IconCheck,
  IconDeviceLaptop,
  IconLogout,
  IconMoon,
  IconPlug,
  IconSettings,
  IconSun,
} from "@tabler/icons-react";
import { useTheme } from "next-themes";

interface UserMenuProps {
  name: string;
  email?: string;
  initials: string;
  onSettings: () => void;
  onConnections?: () => void;
  onSignOut: () => void;
}

export function UserMenu({
  name,
  email,
  initials,
  onSettings,
  onConnections,
  onSignOut,
}: UserMenuProps) {
  const { isMobile } = useSidebar();
  const { theme, setTheme, resolvedTheme } = useTheme();

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
              <span className="block max-w-20 truncate text-[13px] font-medium">
                {name}
              </span>
              <span className="block max-w-35 truncate text-[11px] text-muted-foreground">
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

            {onConnections && (
              <DropdownMenuItem onClick={onConnections}>
                <IconPlug />
                Connections
              </DropdownMenuItem>
            )}

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {resolvedTheme === "dark" ? (
                  <IconMoon />
                ) : (
                  <IconSun />
                )}
                Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-36 rounded-xl">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <IconSun />
                  Light
                  {theme === "light" && <IconCheck className="ml-auto size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <IconMoon />
                  Dark
                  {theme === "dark" && <IconCheck className="ml-auto size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <IconDeviceLaptop />
                  System
                  {theme === "system" && <IconCheck className="ml-auto size-4" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

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
