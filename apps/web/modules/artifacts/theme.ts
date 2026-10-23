import {
  AUTO_HEIGHT_SCRIPT,
  CHART_COMPAT_SCRIPT,
  TAILWIND_BROWSER,
} from "./theme-scripts"
import {
  AUTO_HEIGHT_CSS,
  COLOR_SCHEME_CSS,
  PLAIN_BASE_CSS,
  THEME_CSS,
  TOKENS_CSS,
} from "./theme-styles"

export * from "./theme-scripts"
export * from "./theme-styles"

export interface DesignSystemOptions {
  autoHeight?: boolean
}

export function buildHead(theme: "light" | "dark", autoHeight: boolean) {
  return [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<script>document.documentElement.classList.toggle("dark", ${theme === "dark"});</script>`,
    `<style>${TOKENS_CSS}${COLOR_SCHEME_CSS}${autoHeight ? AUTO_HEIGHT_CSS : ""}</style>`,
    `<script>${CHART_COMPAT_SCRIPT}</script>`,
    autoHeight ? `<script>${AUTO_HEIGHT_SCRIPT}</script>` : "",
    `<script src="${TAILWIND_BROWSER}"></script>`,
    `<style type="text/tailwindcss">${THEME_CSS}</style>`,
  ].join("")
}

export function withDesignSystem(
  html: string,
  theme: "light" | "dark" = "light",
  options: DesignSystemOptions = {}
) {
  const head = buildHead(theme, options.autoHeight ?? false)
  const cleaned = html
    .replace(/<script[^>]*cdn\.tailwindcss\.com[^>]*><\/script>/gi, "")
    .replace(/<script[^>]*@tailwindcss\/browser[^>]*><\/script>/gi, "")

  if (/<head[^>]*>/i.test(cleaned)) {
    return cleaned.replace(/<head[^>]*>/i, (match) => `${match}${head}`)
  }
  if (/<html[^>]*>/i.test(cleaned)) {
    return cleaned.replace(
      /<html[^>]*>/i,
      (match) => `${match}<head>${head}</head>`
    )
  }
  return `<!DOCTYPE html><html><head>${head}</head><body>${cleaned}</body></html>`
}

export function svgDocument(svg: string, theme: "light" | "dark" = "light") {
  return `<!DOCTYPE html><html class="${theme === "dark" ? "dark" : ""}"><head><meta charset="utf-8"><style>${TOKENS_CSS}${PLAIN_BASE_CSS}html,body{height:100%}body{display:flex;align-items:center;justify-content:center;padding:0;overflow:hidden}svg{max-width:100%;max-height:100%;height:auto}</style></head><body>${svg}</body></html>`
}
