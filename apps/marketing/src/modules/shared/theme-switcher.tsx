"use client"
import { Button } from "@openbots/ui/components/button"
import { useTheme } from "next-themes"
import { Moon3, Sun, Sun2 } from "reicon-react"

export default function ThemeSwitcher() {
  const { setTheme, resolvedTheme } = useTheme()
  return (
    <Button
      variant="secondary"
      size="icon"
      onClick={() => setTheme(resolvedTheme == "dark" ? "light" : "dark")}
    >
      <Moon3 className="block dark:hidden" />
      <Sun2 className="hidden dark:block" />
    </Button>
  )
}
