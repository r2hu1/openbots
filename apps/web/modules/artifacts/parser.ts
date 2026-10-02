export interface ParsedArtifact {
  id: string;
  type: "html" | "svg" | "mermaid";
  title: string;
  content: string;
}

export interface ContentSegment {
  type: "text" | "artifact";
  text?: string;
  artifact?: ParsedArtifact;
}

const ARTIFACT_REGEX =
  /<openbots-artifact\s+type="([^"]+)"(?:\s+title="([^"]*)")?>([\s\S]*?)<\/openbots-artifact>/gi;

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
    const [fullMatch, rawType, rawTitle, rawContent] = match;
    const matchIndex = match.index;

    // Push preceding text segment if any
    if (matchIndex > lastIndex) {
      const text = content.slice(lastIndex, matchIndex);
      if (text.trim().length > 0) {
        segments.push({ type: "text", text });
      }
    }

    const typeLower = (rawType || "html").toLowerCase().trim();
    const type: "html" | "svg" | "mermaid" =
      typeLower === "svg" || typeLower === "mermaid" ? typeLower : "html";

    const title = (rawTitle || `${type.toUpperCase()} Artifact`).trim();
    const cleanContent = (rawContent || "").trim();

    const artifact: ParsedArtifact = {
      id: `artifact-${artifacts.length + 1}-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      type,
      title,
      content: cleanContent,
    };

    artifacts.push(artifact);
    segments.push({ type: "artifact", artifact });

    lastIndex = matchIndex + fullMatch.length;
    match = ARTIFACT_REGEX.exec(content);
  }

  // Push remaining text segment if any
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex);
    if (text.trim().length > 0) {
      segments.push({ type: "text", text });
    }
  }

  return { segments, artifacts };
}
