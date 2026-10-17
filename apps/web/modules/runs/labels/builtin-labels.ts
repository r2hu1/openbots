import type { StepItem } from "../types"
import { tryExtractHostname, truncateText } from "./label-utils"

export function resolveBuiltinTool(
  normalized: string,
  status: StepItem["status"] | undefined,
  inputObj: Record<string, unknown> | null
): { label: string; detail?: string } | null {
  const isRunning = status === "running"
  const isFailed = status === "failed"

  // Web search
  if (normalized === "web_search" || normalized.includes("duckduckgo")) {
    const query = typeof inputObj?.query === "string" ? inputObj.query : null
    if (isRunning) {
      return {
        label: query
          ? `Searching the web for "${truncateText(query, 36)}"...`
          : "Searching the web...",
        detail: query ?? undefined,
      }
    }
    if (isFailed) {
      return { label: "Web search failed", detail: query ?? undefined }
    }
    return {
      label: query
        ? `Searched the web for "${truncateText(query, 36)}"`
        : "Searched the web",
      detail: query ?? undefined,
    }
  }

  // Fetch web page / read url
  if (
    normalized === "fetch_web_page" ||
    normalized === "fetch_page" ||
    normalized.includes("read_url")
  ) {
    const url = typeof inputObj?.url === "string" ? inputObj.url : null
    const host = url ? tryExtractHostname(url) : null
    if (isRunning) {
      return {
        label: host ? `Reading webpage on ${host}...` : "Reading webpage...",
        detail: url ?? undefined,
      }
    }
    if (isFailed) {
      return {
        label: "Failed to read webpage",
        detail: url ?? undefined,
      }
    }
    return {
      label: host ? `Read webpage from ${host}` : "Read webpage",
      detail: url ?? undefined,
    }
  }

  // HTTP Request
  if (normalized === "http_request") {
    const method =
      typeof inputObj?.method === "string"
        ? inputObj.method.toUpperCase()
        : "GET"
    const url = typeof inputObj?.url === "string" ? inputObj.url : null
    const host = url ? tryExtractHostname(url) : null
    if (isRunning) {
      return {
        label: host
          ? `Sending ${method} request to ${host}...`
          : `Sending ${method} request...`,
        detail: url ?? undefined,
      }
    }
    if (isFailed) {
      return {
        label: `Request to ${host || "service"} failed`,
        detail: url ?? undefined,
      }
    }
    return {
      label: host
        ? `Completed ${method} request to ${host}`
        : `Completed ${method} request`,
      detail: url ?? undefined,
    }
  }

  // Code Execution
  if (normalized === "execute_code" || normalized === "run_code") {
    if (isRunning) return { label: "Running code script..." }
    if (isFailed) return { label: "Code execution failed" }
    return { label: "Executed code script" }
  }

  // Scheduling
  if (normalized === "create_schedule") {
    const taskName =
      typeof inputObj?.taskName === "string"
        ? inputObj.taskName
        : typeof inputObj?.scheduledTaskName === "string"
          ? inputObj.scheduledTaskName
          : null
    if (isRunning) {
      return {
        label: taskName
          ? `Scheduling task "${truncateText(taskName, 30)}"...`
          : "Scheduling task...",
      }
    }
    if (isFailed) return { label: "Failed to schedule task" }
    return {
      label: taskName
        ? `Scheduled task "${truncateText(taskName, 30)}"`
        : "Scheduled task",
    }
  }

  if (normalized === "manage_schedule") {
    const action =
      typeof inputObj?.action === "string" ? inputObj.action : "task"
    if (isRunning) return { label: `Updating schedule (${action})...` }
    if (isFailed) return { label: "Failed to update schedule" }
    return { label: `Updated schedule (${action})` }
  }

  // Common Utilities
  if (normalized === "get_current_time") {
    if (isRunning) return { label: "Checking current time & timezone..." }
    if (isFailed) return { label: "Failed checking time" }
    return { label: "Checked current time" }
  }

  if (normalized === "calculate") {
    const expr =
      typeof inputObj?.expression === "string" ? inputObj.expression : null
    if (isRunning) {
      return {
        label: expr
          ? `Calculating "${truncateText(expr, 24)}"...`
          : "Calculating...",
      }
    }
    if (isFailed) return { label: "Calculation failed" }
    return {
      label: expr
        ? `Calculated "${truncateText(expr, 24)}"`
        : "Calculated result",
    }
  }

  if (normalized === "get_weather") {
    const loc =
      typeof inputObj?.location === "string" ? inputObj.location : null
    if (isRunning) {
      return {
        label: loc
          ? `Checking weather for ${loc}...`
          : "Checking weather forecast...",
      }
    }
    if (isFailed) return { label: "Failed fetching weather" }
    return {
      label: loc ? `Checked weather for ${loc}` : "Checked weather forecast",
    }
  }

  if (normalized === "wikipedia_search") {
    const query = typeof inputObj?.query === "string" ? inputObj.query : null
    if (isRunning) {
      return {
        label: query
          ? `Searching Wikipedia for "${truncateText(query, 30)}"...`
          : "Searching Wikipedia...",
      }
    }
    if (isFailed) return { label: "Wikipedia search failed" }
    return {
      label: query
        ? `Searched Wikipedia for "${truncateText(query, 30)}"`
        : "Found Wikipedia article",
    }
  }

  if (normalized === "currency_converter") {
    if (isRunning) return { label: "Converting currency rates..." }
    if (isFailed) return { label: "Currency conversion failed" }
    return { label: "Converted currency rates" }
  }

  if (normalized === "unit_converter") {
    if (isRunning) return { label: "Converting units..." }
    if (isFailed) return { label: "Unit conversion failed" }
    return { label: "Converted units" }
  }

  if (normalized === "dns_lookup") {
    const domain = typeof inputObj?.domain === "string" ? inputObj.domain : null
    if (isRunning) {
      return {
        label: domain
          ? `Looking up DNS for ${domain}...`
          : "Performing DNS lookup...",
      }
    }
    if (isFailed) return { label: "DNS lookup failed" }
    return {
      label: domain ? `Looked up DNS for ${domain}` : "Performed DNS lookup",
    }
  }

  if (normalized === "json_parser") {
    if (isRunning) return { label: "Parsing JSON payload..." }
    if (isFailed) return { label: "Failed parsing JSON" }
    return { label: "Parsed JSON payload" }
  }

  if (normalized === "text_analyzer") {
    if (isRunning) return { label: "Analyzing text..." }
    if (isFailed) return { label: "Failed text analysis" }
    return { label: "Analyzed text" }
  }

  if (normalized === "transform_text") {
    if (isRunning) return { label: "Transforming text format..." }
    if (isFailed) return { label: "Text transformation failed" }
    return { label: "Transformed text format" }
  }

  if (normalized === "generate_uuid" || normalized === "random_generator") {
    if (isRunning) return { label: "Generating value..." }
    if (isFailed) return { label: "Value generation failed" }
    return { label: "Generated value" }
  }

  return null
}
