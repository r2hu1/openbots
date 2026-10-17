export function humanizeIdentifier(name: string): string {
  return name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase())
}

export function tryExtractHostname(urlStr: string): string | null {
  try {
    const u = new URL(urlStr)
    return u.hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

export function truncateText(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return `${str.slice(0, maxLen - 1)}…`
}

/**
 * Searches input and output objects for the real tool or action name.
 * Handles payloads like:
 * - { tool: "GMAIL_LIST_MESSAGES", args: { ... } }
 * - { tools: [ { name: "GMAIL_LIST_MESSAGES", ... } ] }
 * - { action: "GMAIL_CREATE_EMAIL_DRAFT", ... }
 * - { executions: [ { toolName: "...", ... } ] }
 */
export function extractNestedActionName(data: unknown): string | null {
  if (!data || typeof data !== "object") return null

  const obj = data as Record<string, unknown>

  // Direct properties
  for (const key of [
    "tool",
    "toolName",
    "tool_name",
    "action",
    "actionName",
    "action_name",
    "function",
    "operation",
  ]) {
    const val = obj[key]
    if (typeof val === "string" && val.trim()) {
      return val.trim()
    }
  }

  // Look inside arrays like tools, executions, calls, actions
  for (const arrayKey of [
    "tools",
    "executions",
    "calls",
    "actions",
    "results",
  ]) {
    const arr = obj[arrayKey]
    if (Array.isArray(arr) && arr.length > 0) {
      const first = arr[0]
      if (typeof first === "string") return first
      if (first && typeof first === "object") {
        const found = extractNestedActionName(first)
        if (found) return found
      }
    }
  }

  // Look inside data / result wrapper
  for (const wrapKey of ["data", "result", "payload", "parameters"]) {
    const nested = obj[wrapKey]
    if (nested && typeof nested === "object") {
      const found = extractNestedActionName(nested)
      if (found) return found
    }
  }

  return null
}

/**
 * Extracts inner tool arguments from payload structures like:
 * { tool: "...", arguments: { ... } } or { tools: [ { arguments: { ... } } ] }
 */
export function extractNestedArguments(
  data: unknown
): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null
  const obj = data as Record<string, unknown>

  for (const key of [
    "arguments",
    "args",
    "params",
    "parameters",
    "input",
    "data",
  ]) {
    const val = obj[key]
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return val as Record<string, unknown>
    }
  }

  for (const arrayKey of ["tools", "executions", "calls"]) {
    const arr = obj[arrayKey]
    if (Array.isArray(arr) && arr.length > 0) {
      const first = arr[0]
      if (first && typeof first === "object") {
        const found = extractNestedArguments(first)
        if (found) return found
      }
    }
  }

  return null
}

/**
 * Deep string extraction for helpful display keys
 */
export function extractStringDeep(
  data: unknown,
  keys: string[]
): string | null {
  if (!data || typeof data !== "object") return null
  const obj = data as Record<string, unknown>

  for (const key of keys) {
    const val = obj[key]
    if (typeof val === "string" && val.trim()) {
      return val.trim()
    }
  }

  for (const prop of [
    "data",
    "result",
    "args",
    "arguments",
    "parameters",
    "params",
  ]) {
    const child = obj[prop]
    if (child && typeof child === "object") {
      const found = extractStringDeep(child, keys)
      if (found) return found
    }
  }

  return null
}
