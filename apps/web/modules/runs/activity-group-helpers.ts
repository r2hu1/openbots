import { formatToolStepLabel } from "./tool-label"
import type { StepItem } from "./types"
import { extractTargetDomainOrHost, truncateStr } from "./activity-classifier"

export function buildResearchPresentation(
  steps: StepItem[],
  isRunning: boolean,
  isFailed: boolean
): { title: string; summary?: string } {
  const count = steps.length

  if (isRunning) {
    const latest = [...steps]
      .reverse()
      .find((s) => s.toolInput && typeof s.toolInput === "object")
    const query = (latest?.toolInput as Record<string, unknown>)?.query
    const url = (latest?.toolInput as Record<string, unknown>)?.url
    const host = extractTargetDomainOrHost(url)

    if (typeof query === "string" && query.trim()) {
      return {
        title: "Researching…",
        summary: `Searching for "${truncateStr(query, 32)}"`,
      }
    }
    if (host) {
      return {
        title: "Researching…",
        summary: `Analyzing ${host}`,
      }
    }
    return {
      title: "Researching…",
      summary:
        count > 1 ? "Consulting multiple sources" : "Gathering information",
    }
  }

  if (isFailed) {
    return {
      title: "Research could not be completed",
      summary: count > 1 ? `${count} sources attempted` : undefined,
    }
  }

  // Completed research
  const sourcesCount = steps.filter((s) => {
    const norm = (s.toolName || "").toLowerCase()
    return (
      norm === "fetch_web_page" ||
      norm === "fetch_page" ||
      norm.includes("read_url") ||
      norm.includes("browser")
    )
  }).length

  const queriesCount = steps.filter((s) => {
    const norm = (s.toolName || "").toLowerCase()
    return norm === "web_search" || norm.includes("search")
  }).length

  if (sourcesCount > 0) {
    return {
      title: "Researched sources",
      summary: `${sourcesCount} ${sourcesCount === 1 ? "source" : "sources"} analyzed`,
    }
  }

  if (queriesCount > 0) {
    return {
      title: "Researched web",
      summary: `${queriesCount} ${queriesCount === 1 ? "search query" : "search queries"} completed`,
    }
  }

  return {
    title: "Researched findings",
    summary: `${count} ${count === 1 ? "source" : "sources"} analyzed`,
  }
}

export function buildCommunicationPresentation(
  steps: StepItem[],
  isRunning: boolean,
  isFailed: boolean
): { title: string; summary?: string } {
  const count = steps.length
  const firstStep = steps[0]
  const { label, detail } = formatToolStepLabel(
    firstStep?.toolName,
    firstStep?.status,
    firstStep?.toolInput,
    firstStep?.toolOutput
  )

  if (isRunning) {
    return {
      title: count > 1 ? "Sending communications…" : `${label}…`,
      summary: detail,
    }
  }

  if (isFailed) {
    return {
      title: "Communication attempt failed",
      summary: detail,
    }
  }

  if (count > 1) {
    return {
      title: "Sent communications",
      summary: `${count} updates delivered`,
    }
  }

  return {
    title: label,
    summary: detail,
  }
}

export function buildDocumentPresentation(
  steps: StepItem[],
  isRunning: boolean,
  isFailed: boolean
): { title: string; summary?: string } {
  const count = steps.length
  const firstStep = steps[0]
  const { label, detail } = formatToolStepLabel(
    firstStep?.toolName,
    firstStep?.status,
    firstStep?.toolInput,
    firstStep?.toolOutput
  )

  if (isRunning) {
    return {
      title: count > 1 ? "Updating documents…" : `${label}…`,
      summary: detail,
    }
  }

  if (isFailed) {
    return {
      title: "Document update failed",
      summary: detail,
    }
  }

  if (count > 1) {
    return {
      title: "Updated project files & records",
      summary: `${count} modifications completed`,
    }
  }

  return {
    title: label,
    summary: detail,
  }
}
