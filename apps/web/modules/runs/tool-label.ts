import type { StepItem } from "./types"
import { parseActionTool } from "./labels/action-labels"
import { resolveBuiltinTool } from "./labels/builtin-labels"
import { resolveComposioMetaTool } from "./labels/composio-labels"
import { resolveDaytonaTool } from "./labels/daytona-labels"
import { humanizeIdentifier } from "./labels/label-utils"

export {
  humanizeIdentifier,
  tryExtractHostname,
  truncateText,
} from "./labels/label-utils"

/**
 * Maps tool names, input arguments, output payloads, and status to natural human-readable phrases.
 * Handles:
 * 1. Composio meta tools starting with COMPOSIO_ (e.g. COMPOSIO_MULTI_EXECUTE_TOOL, COMPOSIO_SEARCH_TOOLS, etc.)
 *    where the actual tool/action name and entities live inside input / output.
 * 2. Internal tools (web_search, fetch_web_page, http_request, etc.)
 * 3. Direct integration names (GMAIL_SEND_EMAIL, etc.)
 */
export function formatToolStepLabel(
  toolName?: string | null,
  status?: StepItem["status"],
  input?: unknown,
  output?: unknown
): { label: string; detail?: string } {
  if (!toolName) {
    const defaultVerb =
      status === "running"
        ? "Thinking..."
        : status === "completed"
          ? "Thought completed"
          : "Action failed"
    return { label: defaultVerb }
  }

  const isRunning = status === "running"
  const isFailed = status === "failed"
  const normalized = toolName.toLowerCase()
  const inputObj =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : null
  const outputObj =
    output && typeof output === "object"
      ? (output as Record<string, unknown>)
      : null

  // 1. Composio Meta Tools (starts with COMPOSIO_)
  if (
    normalized.startsWith("composio_") ||
    normalized.startsWith("composio:")
  ) {
    const composioResolved = resolveComposioMetaTool(
      toolName,
      status,
      inputObj,
      outputObj
    )
    if (composioResolved) {
      return composioResolved
    }
  }

  // 2. Builtin utilities, web search, scheduling, etc.
  const builtinResolved = resolveBuiltinTool(normalized, status, inputObj)
  if (builtinResolved) {
    return builtinResolved
  }

  // 3. Daytona Cloud Desktop Tools & Sandboxes
  const daytonaResolved = resolveDaytonaTool(normalized, status, inputObj)
  if (daytonaResolved) {
    return daytonaResolved
  }

  // 4. Direct app-prefix tools (e.g. GMAIL_CREATE_EMAIL_DRAFT, SLACK_SEND_MESSAGE, etc.)
  const directAction = parseActionTool(toolName, status, inputObj, outputObj)
  if (directAction) {
    return directAction
  }

  // 5. General fallback
  const humanized = humanizeIdentifier(toolName)
  if (isRunning) {
    return { label: `Running ${humanized}...` }
  }
  if (isFailed) {
    return { label: `${humanized} failed` }
  }
  return { label: `Completed ${humanized}` }
}
