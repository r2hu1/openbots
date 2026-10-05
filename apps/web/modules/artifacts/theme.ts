const TAILWIND_BROWSER = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"

const CHART_COMPAT_SCRIPT = String.raw`
(function () {
  var current;
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function resolve(value) {
    if (typeof value === "string") {
      return value.replace(/var\((--[\w-]+)\)/g, function (match, name) {
        return cssVar(name) || match;
      });
    }
    if (Array.isArray(value)) return value.map(resolve);
    if (value && Object.getPrototypeOf(value) === Object.prototype) {
      var out = {};
      for (var key in value) out[key] = resolve(value[key]);
      return out;
    }
    return value;
  }
  function wrap(Original) {
    try {
      Original.defaults.color = cssVar("--muted-foreground");
      Original.defaults.borderColor = cssVar("--border");
      Original.defaults.font.family = cssVar("--font-sans");
    } catch (e) {}
    function Wrapped(ctx, config) {
      return new Original(ctx, resolve(config));
    }
    Wrapped.prototype = Original.prototype;
    Object.setPrototypeOf(Wrapped, Original);
    return Wrapped;
  }
  Object.defineProperty(window, "Chart", {
    configurable: true,
    get: function () { return current; },
    set: function (value) {
      current = value && value.defaults ? wrap(value) : value;
    }
  });
})();
`

const AUTO_HEIGHT_SCRIPT = String.raw`
(function () {
  var last = 0;
  function post() {
    var h = Math.ceil(document.body.getBoundingClientRect().height);
    if (h && h !== last) {
      last = h;
      window.parent.postMessage({ type: "openbots:artifact-height", height: h }, "*");
    }
  }
  function start() {
    new ResizeObserver(post).observe(document.body);
    post();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
`

const AUTO_HEIGHT_CSS = `
html, body { height: auto !important; }
.min-h-screen, .min-h-dvh, .min-h-svh { min-height: 0 !important; }
.h-screen, .h-dvh, .h-svh { height: auto !important; }
`

const TOKENS_CSS = `
:root {
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --background: rgba(252 252 251);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: rgba(227 226 225);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.625rem;
}
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
}
`

const COLOR_SCHEME_CSS = `
:root { color-scheme: light; }
.dark { color-scheme: dark; }
`

const PLAIN_BASE_CSS = `
${COLOR_SCHEME_CSS}
*, *::before, *::after { box-sizing: border-box; border-color: var(--border); }
html, body { margin: 0; background: transparent; color: var(--foreground); }
html { font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }
body { padding: 16px; font-size: 14px; line-height: 1.5; }
`

const THEME_CSS = `
@custom-variant dark (&:is(.dark *));
@theme inline {
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --color-foreground: var(--foreground);
  --color-background: var(--background);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
}
@layer base {
  *, ::before, ::after { border-color: var(--border); }
  html { font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }
  body {
    margin: 0;
    padding: 16px;
    background: transparent;
    color: var(--foreground);
    font-size: 14px;
    line-height: 1.5;
  }
  button:not(:disabled) { cursor: pointer; }
}
`

interface DesignSystemOptions {
  autoHeight?: boolean
}

function buildHead(theme: "light" | "dark", autoHeight: boolean) {
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
  return `<!DOCTYPE html><html class="${theme === "dark" ? "dark" : ""}"><head><meta charset="utf-8"><style>${TOKENS_CSS}${PLAIN_BASE_CSS}html,body{height:100%}body{display:flex;align-items:center;justify-content:center;padding:16px;overflow:hidden}svg{max-width:100%;max-height:100%;height:auto}</style></head><body>${svg}</body></html>`
}
