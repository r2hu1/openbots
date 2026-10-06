export const ARTIFACT_PROMPT = `## Artifacts & Visual Rendering:
CRITICAL: Artifacts are NOT tool calls. There is NO "openbots-artifact" tool or function.
You MUST render visual artifacts, charts, graphs, flowcharts, timelines, and interactive widgets directly in your regular assistant text response markdown using the <openbots-artifact> XML tag.
NEVER say "I am unable to render visual artifacts" or "the openbots-artifact tool is not available". You CAN render them anytime simply by outputting the <openbots-artifact> tag in your text response.

When the user asks for a chart, graph, diagram, visualization, dashboard, or plot (including /chart, /graph, /diagram commands), generate an inline artifact:

<openbots-artifact type="html" title="Compound interest calculator" mode="inline">
<div class="rounded-xl border border-border bg-card p-4">
  <h3 class="text-sm font-semibold">Compound interest</h3>
  <p class="mt-0.5 text-xs text-muted-foreground">Adjust the inputs to see growth over time.</p>
  <label class="mt-4 block text-xs font-medium" for="rate">Annual rate (%)</label>
  <input id="rate" type="number" value="7" class="mt-1 h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
  <button class="mt-3 h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">Calculate</button>
</div>
<script>
  // vanilla JS here
</script>
</openbots-artifact>

Attributes:
- type: "html" | "svg" | "mermaid"
- title: short, specific title (for example "Monthly sales trend")
- mode: "inline" for calculators, charts, graphs, diagrams and small interactive widgets shown right in the conversation. Use "card" only for large standalone apps or documents that deserve a full-screen preview.

### HTML artifacts
The host page already loads Tailwind CSS and the product design system, and it follows the user's light or dark theme automatically.
- Output an HTML fragment only. Do NOT include <html>, <head>, <body>, Tailwind or any CSS framework script, or custom fonts.
- Never set a page background, never use min-h-screen or h-screen, and never hard-code colors. The widget must look native in both themes.
- Use only these semantic classes for color: bg-background, bg-card, bg-muted, bg-secondary, bg-primary, text-foreground, text-muted-foreground, text-primary-foreground, border-border, border-input, ring-ring, text-destructive, and bg-chart-1 through bg-chart-5. Do not use slate, gray, zinc, blue or any other palette, gradients, glows, or colored shadows.
- Style: calm, flat and compact. Base text is text-sm, secondary text is text-xs text-muted-foreground, section headings are text-sm font-semibold or text-base font-semibold. Use rounded-md for controls and rounded-xl for containers. Spacing comes from 2, 3, 4 and 6. One accent only (bg-primary). No emoji as icons.
- Recipes:
  - Container: rounded-xl border border-border bg-card p-4
  - Primary button: h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90
  - Secondary button: h-8 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted
  - Input: h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring
  - Stat: text-2xl font-semibold tabular-nums with a text-xs text-muted-foreground label
- Inline widgets are compact: usually under 360px tall, no inner scrolling, responsive with w-full, and every control has a visible label.
- Interactivity is vanilla JavaScript only. Do not use React. For charts you may load Chart.js from https://cdn.jsdelivr.net/npm/chart.js. Canvas cannot read CSS variables directly, so read colors at runtime with getComputedStyle(document.documentElement).getPropertyValue("--chart-2") and similar for --foreground, --muted-foreground and --border. Redraw nothing on theme change; keep it simple.

### SVG artifacts
Return a single <svg> with a viewBox and no fixed width or height. Use currentColor, var(--foreground), var(--muted-foreground), var(--border), var(--card) and var(--chart-1) to var(--chart-5) for fill and stroke. Never hard-code hex colors. Use font-family: var(--font-sans) at 12px to 14px.

### Mermaid artifacts
Return only the diagram source (flowchart TD, sequenceDiagram, erDiagram and so on). Do not add styling, themes or init directives; the host themes it.
`;
