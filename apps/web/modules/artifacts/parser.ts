export interface ParsedArtifact {
  id: string;
  type: "html" | "svg" | "mermaid" | "file";
  title: string;
  content: string;
  mode?: "inline" | "card";
  isStreaming?: boolean;
  // Extended file artifact attributes
  source?: string;
  fileType?: string;
  size?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContentSegment {
  id: string;
  type: "text" | "artifact";
  text?: string;
  artifact?: ParsedArtifact;
}

const ARTIFACT_REGEX =
  /<openbots-artifact\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/openbots-artifact>)/gi;

function parseAttributes(rawAttrs: string = ""): {
  id?: string;
  type?: string;
  title?: string;
  mode?: string;
  source?: string;
  size?: string;
  filetype?: string;
  createdat?: string;
  updatedat?: string;
  [key: string]: string | undefined;
} {
  const attrs: Record<string, string> = {};
  const KNOWN_EXTS = new Set([
    "pdf", "docx", "doc", "pptx", "ppt", "xlsx", "xls", "csv", "txt", "md",
    "json", "html", "js", "ts", "py", "png", "jpg", "jpeg", "webp", "svg",
  ]);

  // Support key="val", key='val', key={val}
  const attrRegex = /([a-zA-Z0-9_-]+)=(?:"([^"]*)"|'([^']*)'|{([^}]*)})/g;
  let match = attrRegex.exec(rawAttrs);
  while (match !== null) {
    const key = match[1]?.toLowerCase();
    const val = (match[2] ?? match[3] ?? match[4])?.trim();
    if (key && val !== undefined) {
      if (key === "type") {
        if (val.toLowerCase() === "file") {
          attrs.type = "file";
        } else if (KNOWN_EXTS.has(val.toLowerCase())) {
          attrs.filetype = val.toLowerCase();
          if (!attrs.type) attrs.type = "file";
        } else if (!attrs.type) {
          attrs.type = val;
        } else {
          attrs.filetype = val;
        }
      } else {
        attrs[key] = val;
      }
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
      source: rawSource,
      size: rawSize,
      filetype: rawFileType,
      createdat: rawCreatedAt,
      updatedat: rawUpdatedAt,
    } = parseAttributes(rawAttrs);

    const typeLower = (rawType || "html").toLowerCase().trim();
    const type: "html" | "svg" | "mermaid" | "file" =
      typeLower === "svg" || typeLower === "mermaid" || typeLower === "file"
        ? typeLower
        : "html";

    const title = (
      rawTitle ||
      (type === "file" && rawSource
        ? rawSource.split("/").pop() || "Document"
        : `${type.toUpperCase()} Artifact`)
    ).trim();
    const cleanContent = (rawContent || "").trim();
    const titleLower = title.toLowerCase();
    const isBigTask =
      type === "html" &&
      (titleLower.includes("portfolio") ||
        titleLower.includes("landing page") ||
        titleLower.includes("website") ||
        titleLower.includes("dashboard") ||
        titleLower.includes("game") ||
        titleLower.includes("store") ||
        titleLower.includes("e-commerce") ||
        titleLower.includes("app") ||
        titleLower.includes("resume") ||
        titleLower.includes("presentation") ||
        cleanContent.length > 2500);

    const mode: "inline" | "card" =
      type === "file"
        ? "inline"
        : isBigTask
          ? "card"
          : rawMode === "inline"
            ? "inline"
            : rawMode === "card"
              ? "card"
              : type === "mermaid" || type === "svg"
                ? "inline"
                : "card";

    // Detect file type if not provided explicitly
    const fileType =
      rawFileType ||
      (rawSource && rawSource.includes(".")
        ? rawSource.split(".").pop()?.toLowerCase()
        : title.includes(".")
          ? title.split(".").pop()?.toLowerCase()
          : undefined);

    const artifact: ParsedArtifact = {
      id: `artifact-${artifacts.length + 1}-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      type,
      title,
      content: cleanContent,
      mode,
      isStreaming: false,
      source: rawSource,
      fileType,
      size: rawSize,
      createdAt: rawCreatedAt,
      updatedAt: rawUpdatedAt,
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

  // Handle remaining text and check for optimistic / live streaming unclosed artifacts
  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex);

    // Case 1: Opening tag is complete and content is streaming
    const streamingOpenMatch = /<openbots-artifact\s+([^>]*?)>([\s\S]*)$/i.exec(
      remaining,
    );

    // Case 2: Opening tag itself is still being streamed
    const streamingTagMatch = !streamingOpenMatch
      ? /<openbots-artifact(\s+[^>]*)?$/i.exec(remaining)
      : null;

    if (streamingOpenMatch) {
      const matchIndex = streamingOpenMatch.index;
      const rawAttrs = streamingOpenMatch[1] || "";
      const rawContent = streamingOpenMatch[2] || "";

      // Push text prior to the streaming artifact
      if (matchIndex > 0) {
        const text = remaining.slice(0, matchIndex);
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
        source: rawSource,
        size: rawSize,
        filetype: rawFileType,
        createdat: rawCreatedAt,
        updatedat: rawUpdatedAt,
      } = parseAttributes(rawAttrs);

      const typeLower = (rawType || "html").toLowerCase().trim();
      const type: "html" | "svg" | "mermaid" | "file" =
        typeLower === "svg" || typeLower === "mermaid" || typeLower === "file"
          ? typeLower
          : "html";

      const title = (
        rawTitle ||
        (type === "file" && rawSource
          ? rawSource.split("/").pop() || "Document"
          : `${type.toUpperCase()} Artifact`)
      ).trim();
      const cleanContent = rawContent.replace(
        /<\/openbots-artifact?[\s\S]*$/i,
        "",
      );
      const titleLower = title.toLowerCase();
      const isBigTask =
        type === "html" &&
        (titleLower.includes("portfolio") ||
          titleLower.includes("landing page") ||
          titleLower.includes("website") ||
          titleLower.includes("dashboard") ||
          titleLower.includes("game") ||
          titleLower.includes("store") ||
          titleLower.includes("e-commerce") ||
          titleLower.includes("app") ||
          titleLower.includes("resume") ||
          titleLower.includes("presentation") ||
          cleanContent.length > 2500);

      const mode: "inline" | "card" =
        type === "file"
          ? "inline"
          : isBigTask
            ? "card"
            : rawMode === "inline"
              ? "inline"
              : rawMode === "card"
                ? "card"
                : type === "mermaid" || type === "svg"
                  ? "inline"
                  : "card";

      const fileType =
        rawFileType ||
        (rawSource && rawSource.includes(".")
          ? rawSource.split(".").pop()?.toLowerCase()
          : title.includes(".")
            ? title.split(".").pop()?.toLowerCase()
            : undefined);

      const artifactIndex = artifacts.length + 1;
      const artifact: ParsedArtifact = {
        id: `artifact-${artifactIndex}-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        type,
        title,
        content: cleanContent,
        mode,
        isStreaming: true,
        source: rawSource,
        fileType,
        size: rawSize,
        createdAt: rawCreatedAt,
        updatedAt: rawUpdatedAt,
      };

      artifacts.push(artifact);
      segments.push({
        id: `seg-art-${artifact.id}`,
        type: "artifact",
        artifact,
      });
    } else if (streamingTagMatch) {
      const matchIndex = streamingTagMatch.index;
      const rawAttrs = streamingTagMatch[1] || "";

      if (matchIndex > 0) {
        const text = remaining.slice(0, matchIndex);
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

      const title = (
        rawTitle || `Creating ${type.toUpperCase()} Artifact...`
      ).trim();
      const mode = rawMode === "inline" ? "inline" : "card";
      const artifactIndex = artifacts.length + 1;

      const artifact: ParsedArtifact = {
        id: `artifact-${artifactIndex}-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        type,
        title,
        content: "",
        mode,
        isStreaming: true,
      };

      artifacts.push(artifact);
      segments.push({
        id: `seg-art-${artifact.id}`,
        type: "artifact",
        artifact,
      });
    } else {
      if (remaining.trim().length > 0) {
        segments.push({
          id: `seg-text-end-${lastIndex}`,
          type: "text",
          text: remaining,
        });
      }
    }
  }

  return { segments, artifacts };
}
