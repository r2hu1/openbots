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
- Never set a page background, never use min-h-screen or h-screen, and never hard-code colors.
- The widget must look native in both light and dark themes.
- Use only these semantic classes for color:
  bg-background
  bg-card
  bg-muted
  bg-secondary
  bg-primary
  text-foreground
  text-muted-foreground
  text-primary-foreground
  border-border
  border-input
  ring-ring
  text-destructive
  bg-chart-1
  bg-chart-2
  bg-chart-3
  bg-chart-4
  bg-chart-5
- Do not use slate, gray, zinc, blue, red, green, purple or any other hard-coded palette.
- Do not use gradients, glows, colored shadows, or arbitrary color values.
- Style: calm, flat and compact.
- Base text is text-sm.
- Secondary text is text-xs text-muted-foreground.
- Section headings are text-sm font-semibold or text-base font-semibold.
- Use rounded-md for controls and rounded-xl for containers.
- Spacing comes from 2, 3, 4 and 6.
- One UI accent only: bg-primary.
- No emoji as icons.

### HTML recipes

Container:
rounded-xl border border-border bg-card p-4

Primary button:
h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90

Secondary button:
h-8 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted

Input:
h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring

Stat:
text-2xl font-semibold tabular-nums

Stat label:
text-xs text-muted-foreground

### Inline widgets

- Inline widgets are compact, usually under 360px tall.
- Do not create inner scrolling containers.
- Use w-full for responsive content.
- Every interactive control must have a visible label.
- Interactivity must use vanilla JavaScript only.
- Do not use React.
- Avoid unnecessary animation.
- Keep the first rendered state immediately useful.

### Charts

Charts have a dedicated semantic color system.

NEVER use --primary, --primary-foreground, --secondary, --accent, --destructive, or hard-coded colors for chart data.

Chart data colors MUST use these tokens:

--chart-1
--chart-2
--chart-3
--chart-4
--chart-5

For Chart.js, CSS variables cannot be passed directly to canvas rendering. Always resolve them at runtime:

const styles = getComputedStyle(document.documentElement)

const chart1 = styles.getPropertyValue("--chart-1").trim()
const chart2 = styles.getPropertyValue("--chart-2").trim()
const chart3 = styles.getPropertyValue("--chart-3").trim()
const chart4 = styles.getPropertyValue("--chart-4").trim()
const chart5 = styles.getPropertyValue("--chart-5").trim()

Use the chart colors in this order:

- First dataset → --chart-1
- Second dataset → --chart-2
- Third dataset → --chart-3
- Fourth dataset → --chart-4
- Fifth dataset → --chart-5
- Additional datasets → cycle back through --chart-1 to --chart-5

For a single dataset, always use --chart-1.

Example:

const styles = getComputedStyle(document.documentElement)

new Chart(ctx, {
  type: "bar",
  data: {
    labels: ["Q1", "Q2", "Q3", "Q4"],
    datasets: [{
      label: "Revenue",
      data: [120, 180, 150, 220],
      backgroundColor: styles.getPropertyValue("--chart-1").trim(),
      borderColor: styles.getPropertyValue("--chart-1").trim()
    }]
  }
})

For multiple datasets:

datasets: [
  {
    label: "Revenue",
    data: [...],
    backgroundColor: styles.getPropertyValue("--chart-1").trim(),
    borderColor: styles.getPropertyValue("--chart-1").trim()
  },
  {
    label: "Profit",
    data: [...],
    backgroundColor: styles.getPropertyValue("--chart-2").trim(),
    borderColor: styles.getPropertyValue("--chart-2").trim()
  }
]

Chart text MUST use:

--foreground

Secondary chart text and tick labels SHOULD use:

--muted-foreground

Chart grid lines and borders MUST use:

--border

Chart background, when needed, SHOULD use:

--background

or

--card

Never use --primary as a substitute for --chart-1.

Never use getComputedStyle(...).getPropertyValue("--primary") for dataset colors.

Never invent chart colors.

Never use hex, rgb(), rgba(), hsl(), hsla(), oklch(), Tailwind palette colors, or named colors for chart data when a chart token is available.

Do not add a custom Chart.js color palette. Always use the OpenBots chart tokens.

Canvas cannot read CSS variables directly, so resolve every chart color using getComputedStyle(document.documentElement).

Do not redraw charts on theme changes; keep chart rendering simple.

### Chart.js loading

For charts, you may load:

https://cdn.jsdelivr.net/npm/chart.js

Load Chart.js only when a Chart.js canvas is actually needed.

Do not load Chart.js for SVG, Mermaid, tables, cards, or non-chart artifacts.

### Chart types

Choose the chart type based on the data:

- Bar chart: categorical comparisons or discrete values.
- Line chart: ordered or time-series data.
- Doughnut/pie chart: part-to-whole relationships with a small number of categories.
- Scatter chart: relationships between two numeric variables.

Prefer a single dataset when one dataset communicates the information clearly.

Use multiple datasets only when comparing genuinely different measures.

### Chart styling

Charts should visually match the OpenBots design system:

- Use border-radius where supported.
- Use restrained grid lines.
- Avoid unnecessary legends.
- Hide legends when the chart has only one clearly labeled dataset.
- Keep axis labels readable.
- Use compact numeric formatting for large values.
- Avoid excessive chart decoration.
- Do not use gradients.
- Do not use shadows.
- Do not use neon or saturated arbitrary colors.
- Keep chart colors consistent across the artifact.

### SVG artifacts

Return a single <svg> with a viewBox and no fixed width or height.

Use:

currentColor
var(--foreground)
var(--muted-foreground)
var(--border)
var(--card)
var(--chart-1)
var(--chart-2)
var(--chart-3)
var(--chart-4)
var(--chart-5)

for fill and stroke.

Never hard-code hex colors.

Use font-family: var(--font-sans) at 12px to 14px.

For data visualization colors, use var(--chart-1) through var(--chart-5).

Do not use var(--primary) for data visualization.

### Mermaid artifacts

Return only the diagram source:

flowchart TD
sequenceDiagram
erDiagram
and so on.

Do not add styling, themes, init directives, or hard-coded colors.

The host themes Mermaid automatically.

### General artifact rules

- Prefer semantic design tokens over visual guesses.
- Never hard-code colors.
- Never use arbitrary Tailwind colors.
- Preserve light/dark theme compatibility.
- Keep artifacts self-contained.
- Do not use external libraries unless they are explicitly allowed above.
- Do not use React.
- Do not use JSX.
- Do not include markdown fences inside <openbots-artifact>.
- Ensure all JavaScript runs after the relevant DOM elements exist.
- Use unique IDs when multiple artifacts could appear in the same response.
- Keep inline artifacts compact and immediately useful.
`
