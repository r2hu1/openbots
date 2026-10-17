export type View = "preview" | "code"

export type Token = { text: string; cls?: string }

export const FILE_META: Record<string, { ext: string; mime: string }> = {
  html: { ext: "html", mime: "text/html" },
  svg: { ext: "svg", mime: "image/svg+xml" },
  mermaid: { ext: "mmd", mime: "text/plain" },
  file: { ext: "bin", mime: "application/octet-stream" },
}

export const TOKEN_RE = new RegExp(
  [
    "(<!--[\\s\\S]*?-->|\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*)",
    "(\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*'|`(?:\\\\.|[^`\\\\])*`)",
    "(<\\/?[A-Za-z][\\w:.-]*|\\/?>)",
    "(\\b\\d+(?:\\.\\d+)?\\b)",
    "(\\b(?:import|from|export|default|const|let|var|function|return|if|else|for|while|new|class|interface|type|async|await|true|false|null|undefined|typeof|this)\\b)",
  ].join("|"),
  "g"
)

export const TOKEN_CLASSES = [
  "text-muted-foreground italic",
  "text-emerald-600 dark:text-lime-300",
  "text-orange-600 dark:text-orange-300",
  "text-amber-600 dark:text-amber-300",
  "text-violet-600 dark:text-violet-400",
]

export function highlight(code: string, enabled: boolean): Token[][] {
  const tokens: Token[] = []

  if (!enabled) {
    tokens.push({ text: code })
  } else {
    let last = 0
    for (const match of code.matchAll(TOKEN_RE)) {
      const index = match.index ?? 0
      if (index > last) tokens.push({ text: code.slice(last, index) })
      const group = match.findIndex((value, i) => i > 0 && value !== undefined)
      tokens.push({ text: match[0], cls: TOKEN_CLASSES[group - 1] })
      last = index + match[0].length
    }
    if (last < code.length) tokens.push({ text: code.slice(last) })
  }

  let current: Token[] = []
  const lines: Token[][] = [current]
  for (const token of tokens) {
    const parts = token.text.split("\n")
    parts.forEach((part, i) => {
      if (i > 0) {
        current = []
        lines.push(current)
      }
      if (part) current.push({ text: part, cls: token.cls })
    })
  }
  return lines
}

export function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "artifact"
  )
}
