"use client"

import { useTheme } from "next-themes"
import * as React from "react"
import {
  Devices as IconDeviceLaptop,
  Moon as IconMoon,
  Sun as IconSun,
} from "reicon-react"
import { cn } from "@/lib/utils"
import { GroupLabel, SectionHeader } from "./settings-shared"

const THEME_OPTIONS = [
  { id: "light", label: "Light", icon: IconSun },
  { id: "dark", label: "Dark", icon: IconMoon },
  { id: "system", label: "System", icon: IconDeviceLaptop },
] as const

export function AppearanceTab() {
  const { theme, setTheme } = useTheme()

  return (
    <>
      <SectionHeader
        title="Appearance"
        description="Customize the look and feel of OpenBots across your devices."
      />

      <div>
        <GroupLabel>Theme</GroupLabel>
        <div className="grid grid-cols-3 gap-2.5">
          {THEME_OPTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id)}
              aria-pressed={theme === id}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                theme === id
                  ? "border-foreground/80 bg-muted text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
