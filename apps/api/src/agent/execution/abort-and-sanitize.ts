const activeRunAbortControllers = new Map<string, AbortController>();

export function registerRunAbortController(
  runId: string,
  controller: AbortController,
) {
  activeRunAbortControllers.set(runId, controller);
}

export function removeRunAbortController(runId: string) {
  activeRunAbortControllers.delete(runId);
}

export function abortActiveRun(runId: string, reason?: string) {
  const controller = activeRunAbortControllers.get(runId);
  if (controller) {
    controller.abort(reason ? new Error(reason) : undefined);
    activeRunAbortControllers.delete(runId);
  }
}

export function sanitizeErrorMessage(error: unknown): string {
  if (!error) return "Unknown error during execution";
  const rawMessage = error instanceof Error ? error.message : String(error);
  // Redact potential API keys, connection strings, and secrets
  return rawMessage
    .replace(/AIzaSy[a-zA-Z0-9_-]{20,}/g, "[REDACTED_GEMINI_KEY]")
    .replace(/tr_(dev|prod)_[a-zA-Z0-9_-]{20,}/g, "[REDACTED_TRIGGER_KEY]")
    .replace(/sk-[a-zA-Z0-9_-]{20,}/g, "[REDACTED_API_KEY]")
    .replace(/Bearer\s+[a-zA-Z0-9_.-]+/gi, "Bearer [REDACTED_TOKEN]")
    .replace(
      /postgres(ql)?:\/\/[^:]+:([^@]+)@/gi,
      "postgresql://[REDACTED_USER]:[REDACTED_PASSWORD]@",
    )
    .replace(
      /(api[_-]?key|token|secret|password)\s*[:=]\s*['"][^'"]+['"]/gi,
      "$1=[REDACTED]",
    );
}

/**
 * Pre-fetches an image URL using native fetch and returns an AI SDK image part
 * with raw bytes. This avoids AI SDK's internal download logic which requires
 * `undici` — a module unavailable in esbuild-bundled Node deployments.
 */
export async function fetchImagePart(imgUrl: string) {
  try {
    const res = await fetch(imgUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const mimeType = res.headers.get("content-type") || "image/png";
    return {
      type: "image" as const,
      image: new Uint8Array(buf),
      mimeType,
    };
  } catch {
    // Last resort: pass the URL and let AI SDK attempt its own download.
    return { type: "image" as const, image: new URL(imgUrl) };
  }
}
