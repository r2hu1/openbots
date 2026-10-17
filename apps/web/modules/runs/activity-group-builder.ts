import { formatToolStepLabel } from "./tool-label"
import type { StepItem } from "./types"
import type { ActivityCategory } from "./activity-classifier"
import {
  buildCommunicationPresentation,
  buildDocumentPresentation,
  buildResearchPresentation,
} from "./activity-group-helpers"

export {
  buildCommunicationPresentation,
  buildDocumentPresentation,
  buildResearchPresentation,
}

/**
 * Summarize a group of steps sharing the same category into a single human headline & summary.
 */
export function buildGroupPresentation(
  category: ActivityCategory,
  steps: StepItem[]
): { title: string; summary?: string } {
  const isRunning = steps.some((s) => s.status === "running")
  const isFailed = steps.some((s) => s.status === "failed")
  const count = steps.length

  if (category === "research") {
    return buildResearchPresentation(steps, isRunning, isFailed)
  }

  if (category === "communication") {
    return buildCommunicationPresentation(steps, isRunning, isFailed)
  }

  if (category === "document") {
    return buildDocumentPresentation(steps, isRunning, isFailed)
  }

  if (category === "schedule") {
    const firstStep = steps[0]
    const { label } = formatToolStepLabel(
      firstStep?.toolName,
      firstStep?.status,
      firstStep?.toolInput,
      firstStep?.toolOutput
    )
    return {
      title: isRunning ? `${label}…` : label,
    }
  }

  if (category === "code") {
    if (isRunning) {
      return {
        title: "Executing script…",
        summary: "Running automated computation",
      }
    }
    if (isFailed) {
      return {
        title: "Execution failed",
        summary: "Encountered script error",
      }
    }
    return {
      title: "Executed computation script",
      summary: count > 1 ? `${count} iterations executed` : undefined,
    }
  }

  if (category === "data") {
    if (count > 1) {
      if (isRunning) {
        return {
          title: "Processing queries…",
          summary: `Running ${count} checks`,
        }
      }
      if (isFailed) {
        return {
          title: "Queries encountered errors",
          summary: `${count} requests run`,
        }
      }
      return {
        title: "Processed queries & data",
        summary: `${count} requests completed`,
      }
    }

    const firstStep = steps[0]
    const { label, detail } = formatToolStepLabel(
      firstStep?.toolName,
      firstStep?.status,
      firstStep?.toolInput,
      firstStep?.toolOutput
    )
    return {
      title: isRunning ? `${label}…` : label,
      summary: detail,
    }
  }

  // Fallback for general actions
  const firstStep = steps[0]
  const { label, detail } = formatToolStepLabel(
    firstStep?.toolName,
    firstStep?.status,
    firstStep?.toolInput,
    firstStep?.toolOutput
  )

  if (count > 1) {
    if (isRunning) {
      return {
        title: "Working on tasks…",
        summary: `${count} operations in progress`,
      }
    }
    return {
      title: "Completed tasks",
      summary: `${count} operations completed`,
    }
  }

  return {
    title: isRunning ? `${label}…` : label,
    summary: detail,
  }
}
