import type { StepItem } from "./types"

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

  // 2. Web search
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

  // 3. Browserbase Cloud Browser Tools
  if (normalized === "browser_navigate") {
    const url = typeof inputObj?.url === "string" ? inputObj.url : null
    const host = url ? tryExtractHostname(url) : null
    if (isRunning) {
      return {
        label: host ? `Navigating browser to ${host}...` : "Opening browser...",
        detail: url ?? undefined,
      }
    }
    if (isFailed) {
      return {
        label: `Failed to navigate browser to ${host || "URL"}`,
        detail: url ?? undefined,
      }
    }
    return {
      label: host ? `Navigated browser to ${host}` : "Navigated browser",
      detail: url ?? undefined,
    }
  }

  if (normalized === "browser_click") {
    const selector =
      typeof inputObj?.selector === "string" ? inputObj.selector : null
    if (isRunning)
      return {
        label: `Clicking element "${selector ?? "target"}"...`,
        detail: selector ?? undefined,
      }
    if (isFailed)
      return { label: `Failed to click element`, detail: selector ?? undefined }
    return {
      label: `Clicked element "${selector ?? "target"}"`,
      detail: selector ?? undefined,
    }
  }

  if (normalized === "browser_type") {
    const text = typeof inputObj?.text === "string" ? inputObj.text : null
    const selector =
      typeof inputObj?.selector === "string" ? inputObj.selector : null
    if (isRunning)
      return {
        label: text
          ? `Typing "${truncateText(text, 24)}"...`
          : "Typing in browser...",
        detail: selector ?? undefined,
      }
    if (isFailed)
      return {
        label: "Failed to type in browser",
        detail: selector ?? undefined,
      }
    return {
      label: text
        ? `Typed "${truncateText(text, 24)}"`
        : "Typed text in browser",
      detail: selector ?? undefined,
    }
  }

  if (normalized === "browser_screenshot") {
    if (isRunning) return { label: "Capturing browser screenshot..." }
    if (isFailed) return { label: "Failed to take screenshot" }
    return { label: "Captured browser screenshot" }
  }

  if (normalized === "browser_extract_content") {
    if (isRunning) return { label: "Extracting page content from browser..." }
    if (isFailed) return { label: "Failed to extract page content" }
    return { label: "Extracted page content" }
  }

  if (normalized === "browser_scroll") {
    const dir = inputObj?.direction === "up" ? "up" : "down"
    if (isRunning) return { label: `Scrolling page ${dir}...` }
    if (isFailed) return { label: "Failed to scroll page" }
    return { label: `Scrolled page ${dir}` }
  }

  if (normalized === "browser_evaluate") {
    if (isRunning) return { label: "Evaluating JavaScript in browser..." }
    if (isFailed) return { label: "Failed to run JavaScript in browser" }
    return { label: "Evaluated script in browser" }
  }

  if (normalized === "browser_close") {
    if (isRunning) return { label: "Closing browser session..." }
    if (isFailed) return { label: "Failed to close browser" }
    return { label: "Closed browser session" }
  }

  // 4. Fetch web page / read url
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
        label: `Failed to read webpage`,
        detail: url ?? undefined,
      }
    }
    return {
      label: host ? `Read webpage from ${host}` : "Read webpage",
      detail: url ?? undefined,
    }
  }

  // 4. HTTP Request
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

  // 5. Code Execution
  if (normalized === "execute_code" || normalized === "run_code") {
    if (isRunning) return { label: "Running code script..." }
    if (isFailed) return { label: "Code execution failed" }
    return { label: "Executed code script" }
  }

  // 6. Scheduling
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

  // 7. Common Utilities
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

  // 8. Cloud Browser (Browserbase) Tools
  if (normalized.startsWith("browser_")) {
    if (normalized === "browser_navigate") {
      const url = typeof inputObj?.url === "string" ? inputObj.url : null
      if (isRunning)
        return {
          label: url
            ? `Navigating to ${url}...`
            : "Navigating in cloud browser...",
        }
      if (isFailed) return { label: "Failed to navigate" }
      return {
        label: url ? `Navigated to ${url}` : "Navigated in cloud browser",
      }
    }
    if (normalized === "browser_click") {
      const selector =
        typeof inputObj?.selector === "string" ? inputObj.selector : null
      if (isRunning)
        return {
          label: selector
            ? `Clicking ${selector}...`
            : "Clicking element in browser...",
        }
      if (isFailed) return { label: "Failed to click element" }
      return { label: selector ? `Clicked ${selector}` : "Clicked element" }
    }
    if (normalized === "browser_type") {
      const selector =
        typeof inputObj?.selector === "string" ? inputObj.selector : null
      if (isRunning)
        return {
          label: selector
            ? `Typing into ${selector}...`
            : "Typing in browser...",
        }
      if (isFailed) return { label: "Failed to type input" }
      return { label: selector ? `Typed into ${selector}` : "Typed input" }
    }
    if (normalized === "browser_screenshot") {
      if (isRunning) return { label: "Capturing browser screenshot..." }
      if (isFailed) return { label: "Failed to take screenshot" }
      return { label: "Captured browser screenshot" }
    }
    if (normalized === "browser_wait_for_user") {
      const message =
        typeof inputObj?.message === "string" ? inputObj.message : null
      if (isRunning)
        return {
          label: message
            ? `Waiting for user: "${message}"`
            : "Waiting for user action in browser...",
        }
      if (isFailed) return { label: "User action timed out" }
      return { label: "User interaction completed" }
    }
    if (normalized === "browser_extract_content") {
      if (isRunning) return { label: "Extracting page content..." }
      if (isFailed) return { label: "Failed to extract content" }
      return { label: "Extracted page content" }
    }
    if (normalized === "browser_scroll") {
      if (isRunning) return { label: "Scrolling page..." }
      if (isFailed) return { label: "Failed to scroll" }
      return { label: "Scrolled page" }
    }
    if (normalized === "browser_evaluate") {
      if (isRunning) return { label: "Evaluating script in browser..." }
      if (isFailed) return { label: "Script execution failed" }
      return { label: "Evaluated script in browser" }
    }
    if (normalized === "browser_close") {
      if (isRunning) return { label: "Closing cloud browser..." }
      if (isFailed) return { label: "Failed to close browser" }
      return { label: "Closed cloud browser session" }
    }
  }

  // 9. Direct app-prefix tools (e.g. GMAIL_CREATE_EMAIL_DRAFT, SLACK_SEND_MESSAGE, etc.)
  const directAction = parseActionTool(toolName, status, inputObj, outputObj)
  if (directAction) {
    return directAction
  }

  // 9. General fallback
  const humanized = humanizeIdentifier(toolName)
  if (isRunning) {
    return { label: `Running ${humanized}...` }
  }
  if (isFailed) {
    return { label: `${humanized} failed` }
  }
  return { label: `Completed ${humanized}` }
}

/**
 * Resolves meta tools starting with COMPOSIO_, where the actual action is nested in input / output.
 * e.g.:
 * - COMPOSIO_MULTI_EXECUTE_TOOL
 * - COMPOSIO_SEARCH_TOOLS
 * - COMPOSIO_MANAGE_CONNECTIONS / COMPOSIO_WAIT_FOR_CONNECTIONS
 * - COMPOSIO_GET_TOOL_SCHEMAS
 */
function resolveComposioMetaTool(
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

/**
 * Searches input and output objects for the real tool or action name.
 * Handles payloads like:
 * - { tool: "GMAIL_LIST_MESSAGES", args: { ... } }
 * - { tools: [ { name: "GMAIL_LIST_MESSAGES", ... } ] }
 * - { action: "GMAIL_CREATE_EMAIL_DRAFT", ... }
 * - { executions: [ { toolName: "...", ... } ] }
 */
function extractNestedActionName(data: unknown): string | null {
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
function extractNestedArguments(data: unknown): Record<string, unknown> | null {
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
function extractStringDeep(data: unknown, keys: string[]): string | null {
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

/**
 * Formats app-specific action tool names (e.g. GMAIL_CREATE_EMAIL_DRAFT, NOTION_CREATE_PAGE)
 * into natural phrases like "Drafting email...", "Checking emails...", "Posting blog to Medium...", etc.
 */
function parseActionTool(
  toolName: string,
  status?: StepItem["status"],
  inputObj?: Record<string, unknown> | null,
  outputObj?: Record<string, unknown> | null
): { label: string; detail?: string } | null {
  const isRunning = status === "running"
  const isFailed = status === "failed"

  // Check prefix patterns like GMAIL_, SLACK_, GITHUB_, NOTION_, TWITTER_, DISCORD_, HUBSPOT_, AIRTABLE_, etc.
  // Also strip COMPOSIO_ if prepended (e.g. COMPOSIO_GMAIL_SEND_EMAIL)
  const cleanName = toolName.replace(/^composio[_:]/i, "")
  const match = cleanName.match(/^([a-zA-Z0-9]+)[_:](.+)$/)
  if (!match) return null

  const appRaw = match[1]?.toLowerCase()
  const actionRaw = match[2]?.toLowerCase()
  if (!appRaw || !actionRaw) return null

  // App names beautified
  const APP_NAMES: Record<string, string> = {
    gmail: "Gmail",
    mail: "Email",
    slack: "Slack",
    github: "GitHub",
    notion: "Notion",
    twitter: "Twitter / X",
    x: "X",
    discord: "Discord",
    linear: "Linear",
    jira: "Jira",
    hubspot: "HubSpot",
    airtable: "Airtable",
    calendar: "Google Calendar",
    googlecalendar: "Google Calendar",
    sheets: "Google Sheets",
    googlesheets: "Google Sheets",
    docs: "Google Docs",
    drive: "Google Drive",
    trello: "Trello",
    medium: "Medium",
    hashnode: "Hashnode",
    devto: "Dev.to",
    reddit: "Reddit",
    linkedin: "LinkedIn",
    salesforce: "Salesforce",
    shopify: "Shopify",
    stripe: "Stripe",
    clickup: "ClickUp",
    asana: "Asana",
    zendesk: "Zendesk",
  }

  const appName = APP_NAMES[appRaw] || humanizeIdentifier(appRaw)

  // Common action patterns
  // 1. Check emails / list messages / fetch items
  if (
    actionRaw.includes("list") ||
    actionRaw.includes("fetch") ||
    actionRaw.includes("get") ||
    actionRaw.includes("read") ||
    actionRaw.includes("search")
  ) {
    const item = extractTargetEntity(actionRaw) || "items"
    if (appRaw === "gmail" || actionRaw.includes("mail")) {
      if (isRunning) return { label: "Checking emails..." }
      if (isFailed) return { label: "Failed checking emails" }
      return { label: "Checked emails" }
    }

    if (isRunning) return { label: `Checking ${appName} for ${item}...` }
    if (isFailed) return { label: `Failed checking ${appName}` }
    return { label: `Checked ${appName} ${item}` }
  }

  // 2. Draft email / draft post
  if (actionRaw.includes("draft")) {
    const item =
      extractTargetEntity(actionRaw) || (appRaw === "gmail" ? "email" : "draft")
    if (appRaw === "gmail" || actionRaw.includes("mail") || item === "email") {
      if (isRunning) return { label: "Drafting email..." }
      if (isFailed) return { label: "Failed drafting email" }
      return { label: "Drafted email" }
    }

    if (isRunning) return { label: `Drafting ${item} on ${appName}...` }
    if (isFailed) return { label: `Failed drafting ${item} on ${appName}` }
    return { label: `Drafted ${item} on ${appName}` }
  }

  // 3. Send / Post / Publish / Create
  if (
    actionRaw.includes("send") ||
    actionRaw.includes("post") ||
    actionRaw.includes("publish") ||
    actionRaw.includes("create")
  ) {
    if (appRaw === "gmail" || actionRaw.includes("mail")) {
      const recipient =
        extractStringDeep(inputObj, ["to", "recipient", "email"]) ||
        extractStringDeep(outputObj, ["to", "recipient"])
      if (isRunning) {
        return {
          label: recipient
            ? `Sending email to ${recipient}...`
            : "Sending email...",
        }
      }
      if (isFailed) return { label: "Failed to send email" }
      return {
        label: recipient ? `Sent email to ${recipient}` : "Sent email",
      }
    }

    if (
      actionRaw.includes("blog") ||
      actionRaw.includes("article") ||
      actionRaw.includes("story") ||
      actionRaw.includes("post")
    ) {
      if (isRunning) return { label: `Posting blog to ${appName}...` }
      if (isFailed) return { label: `Failed posting blog to ${appName}` }
      return { label: `Posted blog to ${appName}` }
    }

    if (
      actionRaw.includes("issue") ||
      actionRaw.includes("pr") ||
      actionRaw.includes("pull_request")
    ) {
      const entity = actionRaw.includes("pr") ? "pull request" : "issue"
      if (isRunning) return { label: `Creating ${entity} on ${appName}...` }
      if (isFailed) return { label: `Failed creating ${entity} on ${appName}` }
      return { label: `Created ${entity} on ${appName}` }
    }

    if (actionRaw.includes("message")) {
      const channel =
        extractStringDeep(inputObj, ["channel", "to", "recipient", "thread"]) ||
        extractStringDeep(outputObj, ["channel", "to"])
      if (isRunning) {
        return {
          label: channel
            ? `Sending message to ${channel} on ${appName}...`
            : `Sending message on ${appName}...`,
        }
      }
      if (isFailed) return { label: `Failed sending message on ${appName}` }
      return {
        label: channel
          ? `Sent message to ${channel} on ${appName}`
          : `Sent message on ${appName}`,
      }
    }

    const item = extractTargetEntity(actionRaw)
    let actionVerbRunning = "Creating"
    let actionVerbDone = "Created"

    if (actionRaw.includes("send")) {
      actionVerbRunning = "Sending"
      actionVerbDone = "Sent"
    } else if (actionRaw.includes("post") || actionRaw.includes("publish")) {
      actionVerbRunning = "Posting"
      actionVerbDone = "Posted"
    }

    if (isRunning) {
      return {
        label: item
          ? `${actionVerbRunning} ${item} on ${appName}...`
          : `${actionVerbRunning} on ${appName}...`,
      }
    }
    if (isFailed) {
      return { label: `Failed action on ${appName}` }
    }
    return {
      label: item
        ? `${actionVerbDone} ${item} on ${appName}`
        : `${actionVerbDone} on ${appName}`,
    }
  }

  // 4. Delete / Remove
  if (actionRaw.includes("delete") || actionRaw.includes("remove")) {
    const item = extractTargetEntity(actionRaw) || "item"
    if (isRunning) return { label: `Deleting ${item} from ${appName}...` }
    if (isFailed) return { label: `Failed deleting ${item} from ${appName}` }
    return { label: `Deleted ${item} from ${appName}` }
  }

  // 5. Update / Edit
  if (
    actionRaw.includes("update") ||
    actionRaw.includes("edit") ||
    actionRaw.includes("modify")
  ) {
    const item = extractTargetEntity(actionRaw) || "item"
    if (isRunning) return { label: `Updating ${item} on ${appName}...` }
    if (isFailed) return { label: `Failed updating ${item} on ${appName}` }
    return { label: `Updated ${item} on ${appName}` }
  }

  // Generic fallback with app name
  const readableAction = humanizeIdentifier(actionRaw)
  if (isRunning) return { label: `${appName}: ${readableAction}...` }
  if (isFailed) return { label: `${appName}: ${readableAction} failed` }
  return { label: `${appName}: ${readableAction}` }
}

function extractTargetEntity(actionName: string): string | null {
  const parts = actionName.split(/[_-]/)
  const verbs = new Set([
    "get",
    "list",
    "fetch",
    "search",
    "read",
    "create",
    "draft",
    "send",
    "post",
    "publish",
    "update",
    "delete",
    "remove",
    "add",
  ])
  const relevantParts = parts.filter((p) => !verbs.has(p))
  if (relevantParts.length > 0) {
    return relevantParts.join(" ")
  }
  return null
}

function humanizeIdentifier(name: string): string {
  return name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase())
}

function tryExtractHostname(urlStr: string): string | null {
  try {
    const u = new URL(urlStr)
    return u.hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

function truncateText(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return `${str.slice(0, maxLen - 1)}…`
}
