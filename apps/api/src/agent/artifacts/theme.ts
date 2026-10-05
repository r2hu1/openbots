const TAILWIND_BROWSER = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4";

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
`;

const BASE_CSS = `
*, *::before, *::after { box-sizing: border-box; border-color: var(--border); }
html, body { margin: 0; background: transparent; color: var(--foreground); }
html { font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }
body { padding: 16px; font-size: 14px; line-height: 1.5; }
button, input, select, textarea { font: inherit; color: inherit; }
button:not(:disabled) { cursor: pointer; }
`;

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
`;

function buildHead(theme: "light" | "dark") {
  return [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<script>document.documentElement.classList.toggle("dark", ${theme === "dark"});</script>`,
    `<style>${TOKENS_CSS}${BASE_CSS}</style>`,
    `<script src="${TAILWIND_BROWSER}"></script>`,
    `<style type="text/tailwindcss">${THEME_CSS}</style>`,
  ].join("");
}

export function withDesignSystem(
  html: string,
  theme: "light" | "dark" = "light",
) {
  const head = buildHead(theme);
  const cleaned = html
    .replace(/<script[^>]*cdn\.tailwindcss\.com[^>]*><\/script>/gi, "")
    .replace(/<script[^>]*@tailwindcss\/browser[^>]*><\/script>/gi, "");

  if (/<head[^>]*>/i.test(cleaned)) {
    return cleaned.replace(/<head[^>]*>/i, (match) => `${match}${head}`);
  }
  if (/<html[^>]*>/i.test(cleaned)) {
    return cleaned.replace(
      /<html[^>]*>/i,
      (match) => `${match}<head>${head}</head>`,
    );
  }
  return `<!DOCTYPE html><html><head>${head}</head><body>${cleaned}</body></html>`;
}
