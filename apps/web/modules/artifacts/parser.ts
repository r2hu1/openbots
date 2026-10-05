export interface ParsedArtifact {
  id: string;
  type: "html" | "svg" | "mermaid";
  title: string;
  content: string;
  mode?: "inline" | "card";
}

export interface ContentSegment {
  id: string;
  type: "text" | "artifact";
  text?: string;
  artifact?: ParsedArtifact;
}

const ARTIFACT_REGEX =
  /<openbots-artifact\s+([^>]*?)>([\s\S]*?)<\/openbots-artifact>/gi;

function parseAttributes(rawAttrs: string = ""): {
  type?: string;
  title?: string;
  mode?: string;
} {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
  let match = attrRegex.exec(rawAttrs);
  while (match !== null) {
    const key = match[1];
    const val = match[2];
    if (key !== undefined && val !== undefined) {
      attrs[key.toLowerCase()] = val;
    }
    match = attrRegex.exec(rawAttrs);
  }
  return attrs;
}

export function parseArtifacts(content: string): {
  segments: ContentSegment[];
  artifacts: ParsedArtifact[];
} {
  const segments: ContentSegment[] = [];
  const artifacts: ParsedArtifact[] = [];

  let lastIndex = 0;
  // Reset regex index
  ARTIFACT_REGEX.lastIndex = 0;

  let match = ARTIFACT_REGEX.exec(content);
  while (match !== null) {
    const [fullMatch, rawAttrs = "", rawContent = ""] = match;
    const matchIndex = match.index;

    // Push preceding text segment if any
    if (matchIndex > lastIndex) {
      const text = content.slice(lastIndex, matchIndex);
      if (text.trim().length > 0) {
        segments.push({
          id: `seg-text-${segments.length}-${lastIndex}`,
          type: "text",
          text,
        });
      }
    }

    const {
      type: rawType,
      title: rawTitle,
      mode: rawMode,
    } = parseAttributes(rawAttrs);

    const typeLower = (rawType || "html").toLowerCase().trim();
    const type: "html" | "svg" | "mermaid" =
      typeLower === "svg" || typeLower === "mermaid" ? typeLower : "html";

    const title = (rawTitle || `${type.toUpperCase()} Artifact`).trim();
    const cleanContent = (rawContent || "").trim();
    const mode = rawMode === "inline" ? "inline" : "card";

    const artifact: ParsedArtifact = {
      id: `artifact-${artifacts.length + 1}-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      type,
      title,
      content: cleanContent,
      mode,
    };

    artifacts.push(artifact);
    segments.push({
      id: `seg-art-${artifact.id}`,
      type: "artifact",
      artifact,
    });

    lastIndex = matchIndex + fullMatch.length;
    match = ARTIFACT_REGEX.exec(content);
  }

  // Push remaining text segment if any
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex);
    if (text.trim().length > 0) {
      segments.push({
        id: `seg-text-end-${lastIndex}`,
        type: "text",
        text,
      });
    }
  }

  return { segments, artifacts };
}
