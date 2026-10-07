import { formatToolStepLabel } from "./tool-label";
import type { StepItem } from "./types";
import { sanitizeDisplayData } from "./utils";

export type ActivityCategory =
  | "research"
  | "communication"
  | "document"
  | "schedule"
  | "code"
  | "data"
  | "action";

export interface ActivityGroup {
  id: string;
  category: ActivityCategory;
  title: string;
  summary?: string;
  status: "running" | "completed" | "failed";
  steps: StepItem[];
  startedAt?: string | Date | null;
  completedAt?: string | Date | null;
}

function classifyTool(toolName?: string | null): ActivityCategory {
  if (!toolName) return "action";
  const norm = toolName.toLowerCase().replace(/^composio[_:]/i, "");

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
    return "research";
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
    return "communication";
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
    return "document";
  }

  // Scheduling
  if (
    norm.includes("schedule") ||
    norm.startsWith("calendar") ||
    norm.startsWith("googlecalendar")
  ) {
    return "schedule";
  }

  // Code / scripting
  if (
    norm === "execute_code" ||
    norm === "run_code" ||
    norm.includes("code") ||
    norm.includes("bash") ||
    norm.includes("terminal")
  ) {
    return "code";
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
    return "data";
  }

  return "action";
}

function truncateStr(str: string, maxLen = 36): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 1).trimEnd()}…`;
}

function extractTargetDomainOrHost(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Summarize a group of steps sharing the same category into a single human headline & summary.
 */
function buildGroupPresentation(
  category: ActivityCategory,
  steps: StepItem[],
): { title: string; summary?: string } {
  const isRunning = steps.some((s) => s.status === "running");
  const isFailed = steps.some((s) => s.status === "failed");
  const count = steps.length;

  if (category === "research") {
    if (isRunning) {
      // Find latest search or web read query
      const latest = [...steps]
        .reverse()
        .find((s) => s.toolInput && typeof s.toolInput === "object");
      const query = (latest?.toolInput as Record<string, unknown>)?.query;
      const url = (latest?.toolInput as Record<string, unknown>)?.url;
      const host = extractTargetDomainOrHost(url);

      if (typeof query === "string" && query.trim()) {
        return {
          title: "Researching…",
          summary: `Searching for "${truncateStr(query, 32)}"`,
        };
      }
      if (host) {
        return {
          title: "Researching…",
          summary: `Analyzing ${host}`,
        };
      }
      return {
        title: "Researching…",
        summary:
          count > 1 ? `Consulting multiple sources` : "Gathering information",
      };
    }

    if (isFailed) {
      return {
        title: "Research could not be completed",
        summary: count > 1 ? `${count} sources attempted` : undefined,
      };
    }

    // Completed research
    const sourcesCount = steps.filter((s) => {
      const norm = (s.toolName || "").toLowerCase();
      return (
        norm === "fetch_web_page" ||
        norm === "fetch_page" ||
        norm.includes("read_url") ||
        norm.includes("browser")
      );
    }).length;

    const queriesCount = steps.filter((s) => {
      const norm = (s.toolName || "").toLowerCase();
      return norm === "web_search" || norm.includes("search");
    }).length;

    if (sourcesCount > 0) {
      return {
        title: "Researched sources",
        summary: `${sourcesCount} ${sourcesCount === 1 ? "source" : "sources"} analyzed`,
      };
    }

    if (queriesCount > 0) {
      return {
        title: "Researched web",
        summary: `${queriesCount} ${queriesCount === 1 ? "search query" : "search queries"} completed`,
      };
    }

    return {
      title: "Researched findings",
      summary: `${count} ${count === 1 ? "source" : "sources"} analyzed`,
    };
  }

  if (category === "communication") {
    const firstStep = steps[0];
    const { label, detail } = formatToolStepLabel(
      firstStep?.toolName,
      firstStep?.status,
      firstStep?.toolInput,
      firstStep?.toolOutput,
    );

    if (isRunning) {
      return {
        title: count > 1 ? "Sending communications…" : `${label}…`,
        summary: detail,
      };
    }

    if (isFailed) {
      return {
        title: "Communication attempt failed",
        summary: detail,
      };
    }

    if (count > 1) {
      return {
        title: "Sent communications",
        summary: `${count} updates delivered`,
      };
    }

    return {
      title: label,
      summary: detail,
    };
  }

  if (category === "document") {
    const firstStep = steps[0];
    const { label, detail } = formatToolStepLabel(
      firstStep?.toolName,
      firstStep?.status,
      firstStep?.toolInput,
      firstStep?.toolOutput,
    );

    if (isRunning) {
      return {
        title: count > 1 ? "Updating documents…" : `${label}…`,
        summary: detail,
      };
    }

    if (isFailed) {
      return {
        title: "Document update failed",
        summary: detail,
      };
    }

    if (count > 1) {
      return {
        title: "Updated project files & records",
        summary: `${count} modifications completed`,
      };
    }

    return {
      title: label,
      summary: detail,
    };
  }

  if (category === "schedule") {
    const firstStep = steps[0];
    const { label } = formatToolStepLabel(
      firstStep?.toolName,
      firstStep?.status,
      firstStep?.toolInput,
      firstStep?.toolOutput,
    );
    return {
      title: isRunning ? `${label}…` : label,
    };
  }

  if (category === "code") {
    if (isRunning) {
      return {
        title: "Executing script…",
        summary: "Running automated computation",
      };
    }
    if (isFailed) {
      return {
        title: "Execution failed",
        summary: "Encountered script error",
      };
    }
    return {
      title: "Executed computation script",
      summary: count > 1 ? `${count} iterations executed` : undefined,
    };
  }

  if (category === "data") {
    if (count > 1) {
      if (isRunning) {
        return {
          title: "Processing queries…",
          summary: `Running ${count} checks`,
        };
      }
      if (isFailed) {
        return {
          title: "Queries encountered errors",
          summary: `${count} requests run`,
        };
      }
      return {
        title: "Processed queries & data",
        summary: `${count} requests completed`,
      };
    }

    const firstStep = steps[0];
    const { label, detail } = formatToolStepLabel(
      firstStep?.toolName,
      firstStep?.status,
      firstStep?.toolInput,
      firstStep?.toolOutput,
    );
    return {
      title: isRunning ? `${label}…` : label,
      summary: detail,
    };
  }

  // Fallback for general actions
  const firstStep = steps[0];
  const { label, detail } = formatToolStepLabel(
    firstStep?.toolName,
    firstStep?.status,
    firstStep?.toolInput,
    firstStep?.toolOutput,
  );

  if (count > 1) {
    if (isRunning) {
      return {
        title: "Working on tasks…",
        summary: `${count} operations in progress`,
      };
    }
    return {
      title: "Completed tasks",
      summary: `${count} operations completed`,
    };
  }

  return {
    title: isRunning ? `${label}…` : label,
    summary: detail,
  };
}

/**
 * Normalizes an array of raw StepItem records into clean, grouped ActivityGroups.
 * Contiguous steps sharing the same category (e.g. repeated research searches, batch file writes)
 * are cleanly aggregated so the user perceives coherent goals instead of a flurry of raw tools.
 */
export function normalizeActivities(steps: StepItem[]): ActivityGroup[] {
  const toolSteps = steps.filter((s) => s.type === "tool" || s.toolName);
  if (toolSteps.length === 0) return [];

  const groups: ActivityGroup[] = [];
  let currentGroupSteps: StepItem[] = [];
  let currentCategory: ActivityCategory | null = null;

  const flushGroup = () => {
    if (currentGroupSteps.length === 0 || !currentCategory) return;

    const groupStatus: StepItem["status"] = currentGroupSteps.some(
      (s) => s.status === "running",
    )
      ? "running"
      : currentGroupSteps.some((s) => s.status === "failed")
        ? "failed"
        : "completed";

    const { title, summary } = buildGroupPresentation(
      currentCategory,
      currentGroupSteps,
    );

    const firstStep = currentGroupSteps[0];
    const lastStep = currentGroupSteps[currentGroupSteps.length - 1];
    const groupIdx = groups.length;
    const baseStepId =
      firstStep?.id ||
      (firstStep?.stepNumber !== undefined
        ? `step-${firstStep.stepNumber}`
        : "step");

    groups.push({
      id: `act-${groupIdx}-${baseStepId}-${currentCategory}`,
      category: currentCategory,
      title,
      summary,
      status: groupStatus,
      steps: [...currentGroupSteps],
      startedAt: firstStep?.startedAt,
      completedAt: lastStep?.completedAt,
    });

    currentGroupSteps = [];
    currentCategory = null;
  };

  for (const step of toolSteps) {
    const cat = classifyTool(step.toolName);

    // Group adjacent steps if they belong to the same category (e.g. research + research)
    // For single-shot distinct actions (e.g. communication or schedule), keep separate if different apps
    if (currentCategory === null) {
      currentCategory = cat;
      currentGroupSteps.push(step);
    } else if (
      currentCategory === cat &&
      (cat === "research" || cat === "data" || cat === "code")
    ) {
      currentGroupSteps.push(step);
    } else {
      flushGroup();
      currentCategory = cat;
      currentGroupSteps.push(step);
    }
  }

  flushGroup();
  return groups;
}

export { sanitizeDisplayData };
