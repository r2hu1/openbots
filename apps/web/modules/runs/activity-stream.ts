import {
  type ActivityCategory,
  type ActivityGroup,
  classifyTool,
} from "./activity-classifier"
import { buildGroupPresentation } from "./activity-group-builder"
import type { StepItem } from "./types"
import { sanitizeDisplayData } from "./utils"

export type { ActivityCategory, ActivityGroup }
export { classifyTool } from "./activity-classifier"
export { buildGroupPresentation } from "./activity-group-builder"

/**
 * Normalizes an array of raw StepItem records into clean, grouped ActivityGroups.
 * Contiguous steps sharing the same category (e.g. repeated research searches, batch file writes)
 * are cleanly aggregated so the user perceives coherent goals instead of a flurry of raw tools.
 */
export function normalizeActivities(steps: StepItem[]): ActivityGroup[] {
  const toolSteps = steps.filter((s) => s.type === "tool" || s.toolName)
  if (toolSteps.length === 0) return []

  const groups: ActivityGroup[] = []
  let currentGroupSteps: StepItem[] = []
  let currentCategory: ActivityCategory | null = null

  const flushGroup = () => {
    if (currentGroupSteps.length === 0 || !currentCategory) return

    const groupStatus: StepItem["status"] = currentGroupSteps.some(
      (s) => s.status === "running"
    )
      ? "running"
      : currentGroupSteps.some((s) => s.status === "failed")
        ? "failed"
        : "completed"

    const { title, summary } = buildGroupPresentation(
      currentCategory,
      currentGroupSteps
    )

    const firstStep = currentGroupSteps[0]
    const lastStep = currentGroupSteps[currentGroupSteps.length - 1]
    const groupIdx = groups.length
    const baseStepId =
      firstStep?.id ||
      (firstStep?.stepNumber !== undefined
        ? `step-${firstStep.stepNumber}`
        : "step")

    groups.push({
      id: `act-${groupIdx}-${baseStepId}-${currentCategory}`,
      category: currentCategory,
      title,
      summary,
      status: groupStatus,
      steps: [...currentGroupSteps],
      startedAt: firstStep?.startedAt,
      completedAt: lastStep?.completedAt,
    })

    currentGroupSteps = []
    currentCategory = null
  }

  for (const step of toolSteps) {
    const cat = classifyTool(step.toolName)

    // Group adjacent steps if they belong to the same category (e.g. research + research)
    // For single-shot distinct actions (e.g. communication or schedule), keep separate if different apps
    if (currentCategory === null) {
      currentCategory = cat
      currentGroupSteps.push(step)
    } else if (
      currentCategory === cat &&
      (cat === "research" || cat === "data" || cat === "code")
    ) {
      currentGroupSteps.push(step)
    } else {
      flushGroup()
      currentCategory = cat
      currentGroupSteps.push(step)
    }
  }

  flushGroup()
  return groups
}

export { sanitizeDisplayData }
