import type { StepItem } from "./types"

export type ActivityCategory =
  | "research"
  | "communication"
  | "document"
  | "schedule"
  | "code"
  | "data"
  | "action"

export interface ActivityGroup {
  id: string
  category: ActivityCategory
  title: string
  summary?: string
  status: "running" | "completed" | "failed"
  steps: StepItem[]
  startedAt?: string | Date | null
  completedAt?: string | Date | null
}

export function classifyTool(toolName?: string | null): ActivityCategory {
  if (!toolName) return "action"
  const norm = toolName.toLowerCase().replace(/^composio[_:]/i, "")

  // Research / web searching / browsing / scraping
  if (
    norm === "web_search" ||
    norm.includes("duckduckgo") ||
    norm === "fetch_web_page" ||
    norm === "fetch_page" ||
    norm.includes("browser") ||
    norm.includes("read_url") ||
    norm === "wikipedia_search" ||
    norm.includes("search")
  ) {
    return "research"
  }

  // Communication / messaging
  if (
    norm.startsWith("gmail") ||
    norm.startsWith("slack") ||
    norm.startsWith("discord") ||
    norm.startsWith("telegram") ||
    norm.startsWith("twitter") ||
    norm.startsWith("x_") ||
    norm.startsWith("linkedin") ||
    norm.includes("email") ||
    norm.includes("message") ||
    norm.includes("send_")
  ) {
    return "communication"
  }

  // Document / file / knowledge / sheets / docs / report
  if (
    norm.startsWith("notion") ||
    norm.startsWith("github") ||
    norm.startsWith("linear") ||
    norm.startsWith("jira") ||
    norm.startsWith("airtable") ||
    norm.startsWith("sheets") ||
    norm.startsWith("googlesheets") ||
    norm.startsWith("docs") ||
    norm.startsWith("drive") ||
    norm.includes("file") ||
    norm.includes("document") ||
    norm.includes("report") ||
    norm.includes("create_page")
  ) {
    return "document"
  }

  // Scheduling
  if (
    norm.includes("schedule") ||
    norm.startsWith("calendar") ||
    norm.startsWith("googlecalendar")
  ) {
    return "schedule"
  }

  // Code / scripting
  if (
    norm === "execute_code" ||
    norm === "run_code" ||
    norm.includes("code") ||
    norm.includes("bash") ||
    norm.includes("terminal")
  ) {
    return "code"
  }

  // Data / calculations / conversions / lookups
  if (
    norm === "calculate" ||
    norm === "currency_converter" ||
    norm === "unit_converter" ||
    norm === "get_current_time" ||
    norm === "get_weather" ||
    norm === "dns_lookup" ||
    norm === "http_request"
  ) {
    return "data"
  }

  return "action"
}

export function truncateStr(str: string, maxLen = 36): string {
  if (str.length <= maxLen) return str
  return `${str.slice(0, maxLen - 1).trimEnd()}…`
}

export function extractTargetDomainOrHost(url: unknown): string | null {
  if (typeof url !== "string") return null
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`)
    return parsed.hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}
