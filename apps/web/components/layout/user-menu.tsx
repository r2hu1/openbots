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
  TimeFwd,
} from "reicon-react"
import { AllSchedulesDialog } from "@/modules/schedules/components/all-schedules-dialog"
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
  const [schedulesOpen, setSchedulesOpen] = React.useState(false)

  const handleSettingsClick = () => {
    if (onSettings) {
      onSettings()
    } else {
      setSettingsOpen(true)
    }
  }

  return (
    <SidebarMenu className="min-w-0 flex-1 gap-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:p-2">
      <SidebarMenuItem>
        <SidebarMenuButton
          className="bg-sidebar-accent/50"
          onClick={() => setSchedulesOpen(true)}
        >
          <TimeFwd />
          Schedules
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                className="h-9 w-full group-data-[collapsible=icon]:rounded-full"
                size="lg"
              />
            }
          >
            <Avatar
              className="size-6! group-data-[collapsible=icon]:size-8!"
              name={name}
              variant="pixel"
            />

            <span className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
              <span className="block max-w-30 truncate text-sm font-medium">
                {name}
              </span>
            </span>
            <ChevronDown className="ml-auto size-3! text-sidebar-accent-foreground/50" />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
            className="min-w-56"
          >
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Avatar className="size-7!" name={name} variant="pixel" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-xs">{email}</p>
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
              <DropdownMenuSubContent className="min-w-36">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <Sun2 />
                  Light
                  {theme === "light" && <Check className="ml-auto size-3.5" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <Moon3 />
                  Dark
                  {theme === "dark" && <Check className="ml-auto size-3.5" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <Devices />
                  System
                  {theme === "system" && <Check className="ml-auto size-3.5" />}
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
      <AllSchedulesDialog
        open={schedulesOpen}
        onOpenChange={setSchedulesOpen}
      />
    </SidebarMenu>
  )
}
