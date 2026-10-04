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

/**
 * Splits large agent text into coherent, natural conversational parts/bubbles.
 * If text contains code blocks or openbots-artifacts, it preserves them intact.
 * Breaks on paragraph doubles (\n\n+) or major section breaks when text exceeds threshold.
 */
export function splitIntoMessageParts(
  text: string,
  minChunkLength = 250,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // If text is short or doesn't have paragraph breaks, keep it as single message
  if (trimmed.length < minChunkLength || !trimmed.includes("\n\n")) {
    return [trimmed];
  }

  // Check if text is wrapped inside an artifact or code block
  // We should NOT split inside code blocks (``` ... ```) or artifacts (<openbots-artifact> ... </openbots-artifact>)
  const parts: string[] = [];
  const paragraphs = trimmed.split(/\n{2,}/);

  let currentBuffer = "";
  let inCodeBlock = false;
  let inArtifact = false;

  for (const para of paragraphs) {
    const codeBlockCount = (para.match(/```/g) || []).length;
    const hasArtifactStart = /<openbots-artifact/i.test(para);
    const hasArtifactEnd = /<\/openbots-artifact>/i.test(para);

    if (codeBlockCount % 2 !== 0) {
      inCodeBlock = !inCodeBlock;
    }
    if (hasArtifactStart && !hasArtifactEnd) {
      inArtifact = true;
    } else if (hasArtifactEnd) {
      inArtifact = false;
    }

    if (currentBuffer) {
      currentBuffer += `\n\n${para}`;
    } else {
      currentBuffer = para;
    }

    // Only commit current buffer as a separate message part if:
    // 1. We are not inside a code block or artifact
    // 2. The current buffer is large enough (>= minChunkLength)
    if (!inCodeBlock && !inArtifact && currentBuffer.length >= minChunkLength) {
      parts.push(currentBuffer.trim());
      currentBuffer = "";
    }
  }

  if (currentBuffer.trim()) {
    parts.push(currentBuffer.trim());
  }

  return parts.length > 0 ? parts : [trimmed];
}
