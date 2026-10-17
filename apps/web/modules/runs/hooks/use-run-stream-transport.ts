import type { RunRecord, StepItem } from "../types"

export function getStreamAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "text/event-stream",
  }
  if (typeof window !== "undefined") {
    const token =
      localStorage.getItem("bearer_token") ||
      localStorage.getItem("better-auth_token")
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }
  return headers
}

export function parseSseBlock(rawMessage: string): {
  eventType: string
  dataStr: string
} | null {
  if (!rawMessage.trim()) return null

  let eventType = "message"
  const dataLines: string[] = []

  const lines = rawMessage.split("\n")
  for (const line of lines) {
    if (line.startsWith(":")) {
      // Ignore SSE comments/pings
      continue
    }
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim()
    } else if (line.startsWith("data:")) {
      const content = line.startsWith("data: ") ? line.slice(6) : line.slice(5)
      dataLines.push(content)
    }
  }

  if (dataLines.length === 0) return null
  return {
    eventType,
    dataStr: dataLines.join("\n"),
  }
}

export async function fetchRunTerminalFallback(
  runId: string,
  signal: AbortSignal
): Promise<{ run: RunRecord; steps?: StepItem[] } | null> {
  try {
    const apiBaseUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
    const fallbackHeaders: Record<string, string> = {}
    if (typeof window !== "undefined") {
      const token =
        localStorage.getItem("bearer_token") ||
        localStorage.getItem("better-auth_token")
      if (token) fallbackHeaders.Authorization = `Bearer ${token}`
    }

    const fallbackRes = await fetch(`${apiBaseUrl}/api/runs/${runId}`, {
      headers: fallbackHeaders,
      credentials: "include",
      signal,
    })

    if (!fallbackRes.ok) return null

    const fallbackData = await fallbackRes.json()
    const run = fallbackData?.run
    if (
      run &&
      (run.status === "completed" ||
        run.status === "failed" ||
        run.status === "cancelled")
    ) {
      return { run, steps: fallbackData.steps }
    }
    return null
  } catch {
    return null
  }
}
