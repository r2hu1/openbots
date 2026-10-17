import type { TextRun as TextRunType } from "docx"

export function formatMarkdownLine(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim()
}

export function parseInlineRuns(
  text: string,
  TextRun: typeof TextRunType,
  baseOptions: { italic?: boolean } = {}
) {
  const runs: any[] = []
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)

  for (const token of tokens) {
    if (!token) continue
    if (token.startsWith("**") && token.endsWith("**")) {
      runs.push(
        new TextRun({
          text: token.slice(2, -2),
          bold: true,
          ...baseOptions,
        })
      )
    } else if (token.startsWith("`") && token.endsWith("`")) {
      runs.push(
        new TextRun({
          text: token.slice(1, -1),
          font: "Consolas",
          color: "0F172A",
          shading: { fill: "F1F5F9" },
          ...baseOptions,
        })
      )
    } else if (token.startsWith("*") && token.endsWith("*")) {
      runs.push(
        new TextRun({
          text: token.slice(1, -1),
          italics: true,
          ...baseOptions,
        })
      )
    } else {
      runs.push(
        new TextRun({
          text: token.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)"),
          ...baseOptions,
        })
      )
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text, ...baseOptions })]
}
