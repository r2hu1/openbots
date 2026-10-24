export const AUTO_HEIGHT_CSS = `
html, body { height: auto !important; }
.min-h-screen, .min-h-dvh, .min-h-svh { min-height: 0 !important; }
.h-screen, .h-dvh, .h-svh { height: auto !important; }
`

export const TOKENS_CSS = `
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
  --chart-1: oklch(0.785 0.115 274.713);
  --chart-2: oklch(0.585 0.233 277.117);
  --chart-3: oklch(0.511 0.262 276.966);
  --chart-4: oklch(0.457 0.24 277.023);
  --chart-5: oklch(0.398 0.195 277.366);
  --radius: 0.625rem;
}
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.18 0 0);
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
  --chart-1: oklch(0.785 0.115 274.713);
  --chart-2: oklch(0.585 0.233 277.117);
  --chart-3: oklch(0.511 0.262 276.966);
  --chart-4: oklch(0.457 0.24 277.023);
  --chart-5: oklch(0.398 0.195 277.366);
}
`

export const COLOR_SCHEME_CSS = `
:root { color-scheme: light; }
.dark { color-scheme: dark; }
`

export const PLAIN_BASE_CSS = `
${COLOR_SCHEME_CSS}
*, *::before, *::after { box-sizing: border-box; border-color: var(--border); }
html, body { margin: 0; background: transparent; color: var(--foreground); }
html { font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }
body { padding: 16px; font-size: 14px; line-height: 1.5; }
`

export const THEME_CSS = `
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
  *, ::before, ::after { border-color: var(--border); scrollbar-width: thin; -ms-overflow-style: none; }
  html { font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }
  body {
    margin: 0;
    padding: 0px;
    background: transparent;
    color: var(--foreground);
    font-size: 14px;
    line-height: 1.5;
  }
  button:not(:disabled) { cursor: pointer; }
}
`
