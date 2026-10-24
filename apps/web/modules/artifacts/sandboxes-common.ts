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
    fontSize: "15px",
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
    fontSize: "15px",
  },
}

export function parseViewBoxRatio(svg: string): string | null {
  const dims = parseSvgDimensions(svg)
  return dims ? `${dims.width} / ${dims.height}` : null
}

export function parseSvgDimensions(
  svg: string
): { width: number; height: number } | null {
  const match = svg.match(
    /viewBox\s*=\s*["']\s*([-\d.]+[\s,]+[-\d.]+[\s,]+)?([\d.]+)[\s,]+([\d.]+)\s*["']/i
  )
  if (match) {
    const width = Number(match[2])
    const height = Number(match[3])
    if (width > 0 && height > 0) return { width, height }
  }

  const wMatch = svg.match(/\bwidth\s*=\s*["']([\d.]+)(px)?["']/i)
  const hMatch = svg.match(/\bheight\s*=\s*["']([\d.]+)(px)?["']/i)
  if (wMatch && hMatch) {
    const width = Number(wMatch[1])
    const height = Number(hMatch[1])
    if (width > 0 && height > 0) return { width, height }
  }

  return null
}
