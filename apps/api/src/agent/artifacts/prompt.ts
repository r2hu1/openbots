export const ARTIFACT_BASE_PROMPT = `## Visual Artifacts:
Artifacts are NOT tools. Output them directly in your response text using the <openbots-artifact> XML tag.
Syntax: <openbots-artifact type="html|svg|mermaid|file" title="..." mode="inline|card">...content...</openbots-artifact>

- mode="inline": Compact visual aids (under 360px tall). Used for mini UIs, interactive calculators, timers, compact charts (/chart, /graph), SVG icons/illustrations, and mermaid flowcharts (/diagram).
- mode="card": For full applications, multi-component UIs, dashboards, games, or structured reports/articles. Opens in the dedicated artifact canvas with full-screen preview.
- type="svg": Output raw valid <svg viewBox="..." xmlns="http://www.w3.org/2000/svg">...</svg>.
- type="mermaid": Standard mermaid diagram markup.
- type="file": For downloadable files generated with create_downloadable_file (source="...", fileType="pdf|docx|xlsx|png", title="...").
- type="html": HTML fragment only (NO <html>, <head>, <body>, custom fonts, or page backgrounds). Vanilla JS only, no React.
  - Colors MUST use semantic Tailwind classes to support both light and dark modes natively:
    bg-background, bg-card, bg-muted, bg-secondary, bg-primary, text-foreground, text-muted-foreground, text-primary-foreground, border-border, border-input, ring-ring, text-destructive.
  - Never hardcode colors (no hex, rgb, or palette names like slate/zinc/blue/etc).
  - Base text: text-sm; secondary text: text-xs text-muted-foreground; containers: rounded-xl border border-border bg-card p-4; buttons: rounded-md bg-primary text-primary-foreground px-3 py-1.5; inputs: rounded-md border border-input bg-background px-2.5 py-1.5 text-sm.
  - Interactive Action & Confirmation Buttons:
    Inline HTML artifacts have access to \`sendPrompt(prompt)\` (and \`askQuestion(text)\`) globally.
    Use this to create interactive choices, questionnaires, confirmation buttons, and follow-up option pills!
    Examples:
    - Confirmation: \`<button onclick="sendPrompt('Yes, proceed with deployment')" class="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium cursor-pointer">Confirm & Deploy</button>\`
    - Option choices: \`<button onclick="sendPrompt('Option A: PostgreSQL')" class="px-2.5 py-1 rounded-md border border-border bg-muted/50 hover:bg-muted text-xs cursor-pointer">PostgreSQL</button>\`
    - Collecting inputs: Form submit with \`onclick="sendPrompt('Selected: ' + document.getElementById('my-input').value)"\`.
    When asking the user for choices, preferences, or confirmations, proactively render an inline artifact with these action buttons so the user can answer with one click!`;

export const ARTIFACT_CHART_PROMPT = `### Charts:
- In Chart.js / canvas, CSS variables cannot be passed directly. Resolve them dynamically at runtime:
  const s = getComputedStyle(document.documentElement);
  const c1 = s.getPropertyValue("--chart-1").trim(); // cycle through --chart-1 to --chart-5
  const fg = s.getPropertyValue("--foreground").trim();
  const border = s.getPropertyValue("--border").trim();
- Datasets must use --chart-1 through --chart-5. Chart text uses --foreground, tick labels use --muted-foreground, grid lines use --border.
- Never use hard-coded colors or --primary for chart datasets.`;

export const ARTIFACT_PROMPT = `${ARTIFACT_BASE_PROMPT}\n\n${ARTIFACT_CHART_PROMPT}`;
export { ARTIFACT_CHART_PROMPT as chartPrompt };
