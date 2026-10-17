export const ARTIFACT_CHART_PROMPT = `### Charts

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
`;
