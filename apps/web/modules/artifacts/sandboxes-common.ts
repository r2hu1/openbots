import { useTheme } from "next-themes"

export type ThemeName = "light" | "dark"

export function useIframeTheme(): ThemeName {
  const { resolvedTheme } = useTheme()

  return resolvedTheme === "dark" ? "dark" : "light"
}

export const MERMAID_THEME_VARIABLES: Record<ThemeName, Record<string, string>> = {
  light: {
    background: "transparent",
    primaryColor: "#f5f5f5",
    primaryTextColor: "#0a0a0a",
    primaryBorderColor: "#d4d4d4",
    secondaryColor: "#ffffff",
    tertiaryColor: "#fcfcfb",
    lineColor: "#737373",
    textColor: "#0a0a0a",
    noteBkgColor: "#f5f5f5",
    noteTextColor: "#0a0a0a",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    fontSize: "13px",
  },

  dark: {
    background: "transparent",
    primaryColor: "#262626",
    primaryTextColor: "#fafafa",
    primaryBorderColor: "#404040",
    secondaryColor: "#171717",
    tertiaryColor: "#0a0a0a",
    lineColor: "#a3a3a3",
    textColor: "#fafafa",
    noteBkgColor: "#262626",
    noteTextColor: "#fafafa",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    fontSize: "13px",
  },
}

export function parseViewBoxRatio(svg: string): string | null {
  const match = svg.match(
    /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i
  )

  if (!match) {
    return null
  }

  const width = Number(match[1])
  const height = Number(match[2])

  return width > 0 && height > 0 ? `${width} / ${height}` : null
}
