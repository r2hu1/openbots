export interface ParsedArtifact {
  id: string
  type: "html" | "svg" | "mermaid" | "file"
  title: string
  content: string
  mode?: "inline" | "card"
  isStreaming?: boolean
  // Extended file artifact attributes
  source?: string
  fileType?: string
  size?: string
  createdAt?: string
  updatedAt?: string
}

export interface ContentSegment {
  id: string
  type: "text" | "artifact"
  text?: string
  artifact?: ParsedArtifact
}

export const ARTIFACT_REGEX =
  /<openbots-artifact\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/openbots-artifact>)/gi

export const KNOWN_EXTS = new Set([
  "pdf", "docx", "doc", "pptx", "ppt", "xlsx", "xls", "csv", "txt", "md",
  "json", "html", "js", "ts", "py", "png", "jpg", "jpeg", "webp", "svg",
])

export function parseAttributes(rawAttrs: string = ""): {
  id?: string
  type?: string
  title?: string
  mode?: string
  source?: string
  size?: string
  filetype?: string
  createdat?: string
  updatedat?: string
  [key: string]: string | undefined
} {
  const attrs: Record<string, string> = {}

  // Support key="val", key='val', key={val}
  const attrRegex = /([a-zA-Z0-9_-]+)=(?:"([^"]*)"|'([^']*)'|{([^}]*)})/g
  let match = attrRegex.exec(rawAttrs)
  while (match !== null) {
    const key = match[1]?.toLowerCase()
    const val = (match[2] ?? match[3] ?? match[4])?.trim()
    if (key && val !== undefined) {
      if (key === "type") {
        const valLower = val.toLowerCase()
        if (valLower === "file") {
          attrs.type = "file"
        } else if (valLower === "html" || valLower === "svg" || valLower === "mermaid") {
          // Explicit rich interactive artifact types
          attrs.type = valLower
        } else if (KNOWN_EXTS.has(valLower)) {
          attrs.filetype = valLower
          if (!attrs.type) attrs.type = "file"
        } else if (!attrs.type) {
          attrs.type = val
        } else {
          attrs.filetype = val
        }
      } else {
        attrs[key] = val
      }
    }
    match = attrRegex.exec(rawAttrs)
  }
  return attrs
}

export function resolveArtifactMeta(
  rawAttrs: string,
  rawContent: string
): {
  type: "html" | "svg" | "mermaid" | "file"
  title: string
  cleanContent: string
  mode: "inline" | "card"
  fileType?: string
  rawSource?: string
  rawSize?: string
  rawCreatedAt?: string
  rawUpdatedAt?: string
} {
  const {
    type: rawType,
    title: rawTitle,
    mode: rawMode,
    source: rawSource,
    size: rawSize,
    filetype: rawFileType,
    createdat: rawCreatedAt,
    updatedat: rawUpdatedAt,
  } = parseAttributes(rawAttrs)

  const typeLower = (rawType || "html").toLowerCase().trim()
  const type: "html" | "svg" | "mermaid" | "file" =
    typeLower === "svg" || typeLower === "mermaid" || typeLower === "file"
      ? typeLower
      : "html"

  const title = (
    rawTitle ||
    (type === "file" && rawSource
      ? rawSource.split("/").pop() || "Document"
      : `${type.toUpperCase()} Artifact`)
  ).trim()
  const cleanContent = (rawContent || "").trim()
  const titleLower = title.toLowerCase()
  const isBigTask =
    type === "html" &&
    (titleLower.includes("portfolio") ||
      titleLower.includes("landing page") ||
      titleLower.includes("website") ||
      titleLower.includes("dashboard") ||
      titleLower.includes("game") ||
      titleLower.includes("store") ||
      titleLower.includes("e-commerce") ||
      titleLower.includes("app") ||
      titleLower.includes("resume") ||
      titleLower.includes("presentation") ||
      cleanContent.length > 2500)

  const mode: "inline" | "card" =
    type === "file"
      ? "inline"
      : isBigTask
        ? "card"
        : rawMode === "inline"
          ? "inline"
          : rawMode === "card"
            ? "card"
            : type === "mermaid" || type === "svg"
              ? "inline"
              : "card"

  const titleExt =
    title.includes(".") && title.lastIndexOf(".") < title.length - 1
      ? title.split(".").pop()?.toLowerCase()
      : undefined

  const fileType =
    rawFileType ||
    (rawSource && rawSource.includes(".")
      ? rawSource.split(".").pop()?.toLowerCase()
      : type === "file" && titleExt && KNOWN_EXTS.has(titleExt)
        ? titleExt
        : undefined)

  return {
    type,
    title,
    cleanContent,
    mode,
    fileType,
    rawSource,
    rawSize,
    rawCreatedAt,
    rawUpdatedAt,
  }
}
