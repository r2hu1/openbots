import { ARTIFACT_CHART_PROMPT } from "./chart-prompt.js";

export const ARTIFACT_BASE_PROMPT = `## Artifacts & Visual Rendering:
CRITICAL: Artifacts are NOT tool calls. There is NO "openbots-artifact" tool or function.
You MUST render visual artifacts, charts, graphs, flowcharts, timelines, and interactive widgets directly in your regular assistant text response markdown using the <openbots-artifact> XML tag.
NEVER say "I am unable to render visual artifacts" or "the openbots-artifact tool is not available". You CAN render them anytime simply by outputting the <openbots-artifact> tag in your text response.

When the user asks for a mini UI, chart, graph, diagram, visualization, timer, or compact widget, generate an INLINE artifact:
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

### CRITICAL RULES FOR 'mode' ("inline" vs "card"):
- mode="inline": For MINIMAL inline visual aids that help clarify or visualize the user's immediate question/task directly in the chat flow. Keep them lightweight, minimal, clean, and compact (under 360px height).
  - Use mode="inline" for:
    - Minimal SVG illustrations, diagrams, process flows, architecture icons, and vector schematics
    - Compact charts, trend graphs, or mathematical plots (/chart, /graph)
    - Quick interactive calculators, sliders, unit converters, countdowns/timers, or helper mini-widgets
    - Mermaid sequence/flow diagrams (/diagram)
- mode="card": MANDATORY for all BIG, MEDIUM, complex, or rich multi-section items. These render as a clean card preview in chat and open in the dedicated artifact sheet/canvas with full-screen preview, tabbed source code, and export tools.
  - Use mode="card" for:
    - Medium-to-large UIs, prototypes, forms, dashboards, analytics views
    - Portfolio websites, landing pages, multi-component apps, web games
    - Formatted articles, documents, reports, proposals, resumes, slides
    - Full HTML/CSS interfaces or any widget with substantial content or structure (>360px height)
- SUMMARY RULE: If it's a minimal visual aid or quick helper widget, use mode="inline". If it's medium, big, or full-screen stuff, ALWAYS use mode="card" to keep the chat clean and open in the artifact sheet.

Attributes:
- type: "html" | "svg" | "mermaid" | "file"
- title: short, specific title (e.g. "Developer Portfolio", "Monthly Sales Trend", "System Architecture", "quarterly-report.pdf")
- mode: "inline" (for mini UIs/charts/SVGs/diagrams/timers/files) OR "card" (for portfolios, landing pages, full apps, games, dashboards)
- For type="svg":
  - Output clean, valid raw <svg ...>...</svg> XML markup directly inside the tag: \`<openbots-artifact type="svg" title="..." mode="inline"><svg viewBox="..." xmlns="http://www.w3.org/2000/svg">...</svg></openbots-artifact>\`.
  - SVGs render inline crisply with semantic styling, responsive viewBox scaling, and no opening sheet needed. Use SVGs freely for graphics, diagrams, custom charts, illustrations, schematics, icons, and visual maps!
- For type="file":
  - source: URL of the file (e.g. public Supabase storage URL)
  - fileType: extension or format (e.g. "pdf", "docx", "xlsx", "csv", "json", "png", "zip")
  - size: file size in bytes (optional)
  - createdAt / updatedAt: ISO timestamps (optional)
  - Content: You can include the file's formatted text/content inside the tag: \`<openbots-artifact type="file" source="..." fileType="docx" title="Report.docx">...formatted content...</openbots-artifact>\`.
  - Self-closing is also valid if only source is provided: \`<openbots-artifact type="file" source="https://..." fileType="pdf" title="Quarterly Financial Report.pdf" size="248100" />\`
  - HIGH-QUALITY DOCUMENT GENERATION (HTML/CSS): When creating formatted documents, reports, executive summaries, resumes, or brochures via \`create_downloadable_file\`, you can write modern HTML & CSS in the \`content\` parameter! The backend compiler automatically renders the HTML into a crisp, print-accurate vector PDF (or a styled Word document for \`.docx\`).
    - Use clean semantic HTML (headers, paragraphs, tables, grids, cards).
    - Style using inline styles or a \`<style>\` tag (colors, typography, margins, flexbox).
    - Avoid raw JavaScript or external interactive canvas scripts in downloadable files.
  - CRITICAL FILE CONTENT RULE: When using the tool \`create_downloadable_file\`, NEVER put \`<openbots-artifact ...>\` tags inside the \`content\` parameter. Emit \`<openbots-artifact>\` tags ONLY in your conversational message response for live interactive widgets in the chat.
  - You have total freedom over layouts, styling, structure, and design. For interactive or bespoke visual reports and custom styled documents, you can also output rich \`type="html"\` artifacts styled with Tailwind classes.
  - The UI provides interactive in-sheet live previewing for PDFs, Word DOCX documents, Excel spreadsheets, images, text, and rich downloads.

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
`;

export const ARTIFACT_PROMPT = `${ARTIFACT_BASE_PROMPT}\n${ARTIFACT_CHART_PROMPT}`;
export { ARTIFACT_CHART_PROMPT };
