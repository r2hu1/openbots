export function formatTimestamp(
  dateVal: string | Date | null | undefined,
): string {
  if (!dateVal) return "—";
  try {
    return new Date(dateVal).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(dateVal);
  }
}

export function formatDuration(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function toText(value: unknown, keys: string[], fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof obj[key] === "string") return obj[key] as string;
    }
    return JSON.stringify(obj, null, 2);
  }
  return String(value);
}

export const getInputText = (input: unknown, fallback = "") =>
  toText(input, ["prompt", "text"], fallback);

export const getOutputText = (output: unknown) => toText(output, ["text"]);

export function sanitizeDisplayData(data: unknown): string {
  if (data === undefined || data === null) return "None";
  try {
    const raw = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    return raw
      .replace(/AIzaSy[a-zA-Z0-9_-]{20,}/g, "[REDACTED_GEMINI_KEY]")
      .replace(/tr_(dev|prod)_[a-zA-Z0-9_-]{20,}/g, "[REDACTED_TRIGGER_KEY]")
      .replace(/sk-[a-zA-Z0-9_-]{20,}/g, "[REDACTED_API_KEY]")
      .replace(/Bearer\s+[a-zA-Z0-9_.-]+/gi, "Bearer [REDACTED_TOKEN]");
  } catch {
    return String(data);
  }
}
