import type { StepItem } from "../types"
import {
  extractNestedActionName,
  extractNestedArguments,
  extractStringDeep,
  humanizeIdentifier,
  truncateText,
} from "./label-utils"

export function extractTargetEntity(actionName: string): string | null {
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

export const APP_NAMES: Record<string, string> = {
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

export function parseActionTool(
  toolName: string,
  status?: StepItem["status"],
  inputObj?: Record<string, unknown> | null,
  outputObj?: Record<string, unknown> | null
): { label: string; detail?: string } | null {
  const isRunning = status === "running"
  const isFailed = status === "failed"

  const cleanName = toolName.replace(/^composio[_:]/i, "")
  const match = cleanName.match(/^([a-zA-Z0-9]+)[_:](.+)$/)
  if (!match) return null

  const appRaw = match[1]?.toLowerCase()
  const actionRaw = match[2]?.toLowerCase()
  if (!appRaw || !actionRaw) return null

  const appName = APP_NAMES[appRaw] || humanizeIdentifier(appRaw)

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

  const readableAction = humanizeIdentifier(actionRaw)
  if (isRunning) return { label: `${appName}: ${readableAction}...` }
  if (isFailed) return { label: `${appName}: ${readableAction} failed` }
  return { label: `${appName}: ${readableAction}` }
}
