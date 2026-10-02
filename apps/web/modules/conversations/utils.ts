export function getMessageText(content: unknown): string {
  if (content === null || content === undefined) return "";
  if (typeof content === "string") return content;
  if (typeof content === "object") {
    const obj = content as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.prompt === "string") return obj.prompt;
    return JSON.stringify(obj, null, 2);
  }
  return String(content);
}

export function formatMsgTime(dateVal: string | Date): string {
  try {
    const d = new Date(dateVal);
    const dateStr = d.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
    const timeStr = d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return `${dateStr}, ${timeStr}`;
  } catch {
    return "";
  }
}
