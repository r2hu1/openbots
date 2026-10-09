"use client"

import Avatar from "boring-avatars"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@openbots/ui/components/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@openbots/ui/components/sidebar"
import { useTheme } from "next-themes"
import * as React from "react"
import {
  Check,
  ChevronDown,
  Devices,
  Logout,
  Moon3,
  Plug2,
  Setting,
  Sun2,
} from "reicon-react"
import { SettingsSheet } from "./settings-sheet"

interface UserMenuProps {
  name: string
  email?: string
  initials: string
  onSettings?: () => void
  onConnections?: () => void
  onSignOut: () => void
}

export function UserMenu({
  name,
  email,
  initials,
  onSettings,
  onConnections,
  onSignOut,
}: UserMenuProps) {
  const { isMobile } = useSidebar()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  const handleSettingsClick = () => {
    if (onSettings) {
      onSettings()
    } else {
      setSettingsOpen(true)
    }
  }

  return (
    <SidebarMenu className="min-w-0 flex-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:p-2">
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                className="w-full py-2! group-data-[collapsible=icon]:rounded-full"
                size="lg"
              />
            }
          >
            <Avatar className="size-7!" name={name} variant="pixel" />

            <span className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
              <span className="block max-w-20 truncate text-[13px] font-medium">
                {name}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {email}
              </span>
            </span>
            <ChevronDown className="ml-auto size-4 text-sidebar-accent-foreground/50" />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
            className="min-w-56 rounded-xl"
          >
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Avatar className="size-7!" name={name} variant="pixel" />
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
                <Plug2 />
                Connections
              </DropdownMenuItem>
            )}

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {resolvedTheme === "dark" ? <Moon3 /> : <Sun2 />}
                Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-36 rounded-xl">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <Sun2 />
                  Light
                  {theme === "light" && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <Moon3 />
                  Dark
                  {theme === "dark" && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <Devices />
                  System
                  {theme === "system" && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuItem onClick={handleSettingsClick}>
              <Setting />
              Settings
            </DropdownMenuItem>

            <DropdownMenuItem variant="destructive" onClick={onSignOut}>
              <Logout />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </SidebarMenu>
  )
}
