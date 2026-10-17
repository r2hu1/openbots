import type { StepItem } from "../types"
import { parseActionTool } from "./action-labels"
import {
  extractNestedActionName,
  extractNestedArguments,
  extractStringDeep,
  humanizeIdentifier,
  truncateText,
} from "./label-utils"

/**
 * Resolves meta tools starting with COMPOSIO_, where the actual action is nested in input / output.
 * e.g.:
 * - COMPOSIO_MULTI_EXECUTE_TOOL
 * - COMPOSIO_SEARCH_TOOLS
 * - COMPOSIO_MANAGE_CONNECTIONS / COMPOSIO_WAIT_FOR_CONNECTIONS
 * - COMPOSIO_GET_TOOL_SCHEMAS
 */
export function resolveComposioMetaTool(
  toolName: string,
  status?: StepItem["status"],
  inputObj?: Record<string, unknown> | null,
  outputObj?: Record<string, unknown> | null
): { label: string; detail?: string } | null {
  const isRunning = status === "running"
  const isFailed = status === "failed"
  const subName = toolName.replace(/^composio[_:]/i, "").toLowerCase()

  // Search tools
  if (subName.includes("search")) {
    const query =
      extractStringDeep(inputObj, ["query", "searchTerm", "toolName", "app"]) ||
      extractStringDeep(outputObj, ["query", "searchTerm"])
    if (isRunning) {
      return {
        label: query
          ? `Searching tools for "${truncateText(query, 30)}"...`
          : "Searching available tools...",
      }
    }
    if (isFailed) return { label: "Tool search failed" }
    return {
      label: query
        ? `Found tools for "${truncateText(query, 30)}"`
        : "Found tools",
    }
  }

  // Manage connections / wait for connections
  if (subName.includes("connection")) {
    const app =
      extractStringDeep(inputObj, ["app", "provider", "toolkit"]) ||
      extractStringDeep(outputObj, ["app", "provider", "toolkit"])
    const appLabel = app ? humanizeIdentifier(app) : "app"
    if (isRunning) return { label: `Connecting to ${appLabel}...` }
    if (isFailed) return { label: `Failed connecting to ${appLabel}` }
    return { label: `Connected to ${appLabel}` }
  }

  // Schemas lookup
  if (subName.includes("schema")) {
    return {
      label: isRunning
        ? "Loading tool specifications..."
        : "Loaded tool specifications",
    }
  }

  // Execution: look for action / tool name in input or output
  const nestedToolName =
    extractNestedActionName(inputObj) || extractNestedActionName(outputObj)

  if (nestedToolName) {
    const nestedInput = extractNestedArguments(inputObj)
    const resolved = parseActionTool(
      nestedToolName,
      status,
      nestedInput || inputObj,
      outputObj
    )
    if (resolved) {
      return resolved
    }
  }

  // Look for target app / query / action in input/output to formulate a natural statement
  const targetApp =
    extractStringDeep(inputObj, ["app", "toolkit", "appName", "provider"]) ||
    extractStringDeep(outputObj, ["app", "toolkit", "appName", "provider"])
  const targetAction =
    extractStringDeep(inputObj, ["action", "operation", "endpoint"]) ||
    extractStringDeep(outputObj, ["action", "operation"])

  if (targetApp || targetAction) {
    const appName = targetApp ? humanizeIdentifier(targetApp) : ""
    const actionName = targetAction
      ? humanizeIdentifier(targetAction)
      : "action"
    if (isRunning) {
      return {
        label: appName
          ? `${actionName} on ${appName}...`
          : `Running ${actionName}...`,
      }
    }
    if (isFailed) {
      return {
        label: appName
          ? `Failed ${actionName} on ${appName}`
          : `${actionName} failed`,
      }
    }
    return {
      label: appName
        ? `Completed ${actionName} on ${appName}`
        : `Completed ${actionName}`,
    }
  }

  // Generic Composio fallback
  if (isRunning) return { label: "Executing app action..." }
  if (isFailed) return { label: "App action failed" }
  return { label: "Executed app action" }
}
