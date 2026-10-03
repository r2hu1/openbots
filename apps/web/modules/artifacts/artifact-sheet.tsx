"use client";

import { Button, buttonVariants } from "@openbots/ui/components/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@openbots/ui/components/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openbots/ui/components/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@openbots/ui/components/sheet";
import { Tabs, TabsList, TabsTrigger } from "@openbots/ui/components/tabs";
import {
  IconArrowsDiagonal,
  IconArrowsDiagonalMinimize2,
  IconCheck,
  IconChevronDown,
  IconCode,
  IconEye,
  IconX,
} from "@tabler/icons-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import type { ParsedArtifact } from "./parser";
import { HtmlSandbox, MermaidSandbox, SvgSandbox } from "./sandboxes";

interface ArtifactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artifact: ParsedArtifact | null;
  onPublish?: (artifact: ParsedArtifact) => void;
}

type View = "preview" | "code";
type Token = { text: string; cls?: string };

const FILE_META: Record<string, { ext: string; mime: string }> = {
  html: { ext: "html", mime: "text/html" },
  svg: { ext: "svg", mime: "image/svg+xml" },
  mermaid: { ext: "mmd", mime: "text/plain" },
};

const TOKEN_RE = new RegExp(
  [
    "(<!--[\\s\\S]*?-->|\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*)",
    "(\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*'|`(?:\\\\.|[^`\\\\])*`)",
    "(<\\/?[A-Za-z][\\w:.-]*|\\/?>)",
    "(\\b\\d+(?:\\.\\d+)?\\b)",
    "(\\b(?:import|from|export|default|const|let|var|function|return|if|else|for|while|new|class|interface|type|async|await|true|false|null|undefined|typeof|this)\\b)",
  ].join("|"),
  "g",
);

const TOKEN_CLASSES = [
  "text-muted-foreground italic",
  "text-emerald-600 dark:text-lime-300",
  "text-orange-600 dark:text-orange-300",
  "text-amber-600 dark:text-amber-300",
  "text-violet-600 dark:text-violet-400",
];

function highlight(code: string, enabled: boolean): Token[][] {
  const tokens: Token[] = [];

  if (!enabled) {
    tokens.push({ text: code });
  } else {
    let last = 0;
    for (const match of code.matchAll(TOKEN_RE)) {
      const index = match.index ?? 0;
      if (index > last) tokens.push({ text: code.slice(last, index) });
      const group = match.findIndex((value, i) => i > 0 && value !== undefined);
      tokens.push({ text: match[0], cls: TOKEN_CLASSES[group - 1] });
      last = index + match[0].length;
    }
    if (last < code.length) tokens.push({ text: code.slice(last) });
  }

  let current: Token[] = [];
  const lines: Token[][] = [current];
  for (const token of tokens) {
    const parts = token.text.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) {
        current = [];
        lines.push(current);
      }
      if (part) current.push({ text: part, cls: token.cls });
    });
  }
  return lines;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "artifact"
  );
}

export function ArtifactSheet({
  open,
  onOpenChange,
  artifact,
  onPublish,
}: ArtifactSheetProps) {
  const [view, setView] = React.useState<View>("preview");
  const [copied, setCopied] = React.useState(false);
  const [maximized, setMaximized] = React.useState(false);
  const copyTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setView("preview");
  }, [artifact]);

  React.useEffect(() => {
    return () => {
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
    };
  }, []);

  const lines = React.useMemo(
    () =>
      artifact ? highlight(artifact.content, artifact.type !== "mermaid") : [],
    [artifact],
  );

  const handleCopy = React.useCallback(async () => {
    if (!artifact?.content) return;
    try {
      await navigator.clipboard.writeText(artifact.content);
      setCopied(true);
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
      copyTimeout.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  }, [artifact]);

  const handleDownload = React.useCallback(() => {
    if (!artifact) return;
    const meta = FILE_META[artifact.type] ?? {
      ext: artifact.type,
      mime: "text/plain",
    };
    const blob = new Blob([artifact.content], { type: meta.mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(artifact.title)}.${meta.ext}`;
    link.click();
    URL.revokeObjectURL(url);
  }, [artifact]);

  if (!artifact) return null;

  const typeLabel = artifact.type.toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        showCloseButton={false}
        side="right"
        className={cn(
          "gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-3/4 data-[side=right]:sm:max-w-4xl",
          maximized &&
            "data-[side=right]:sm:left-3 data-[side=right]:sm:w-auto! data-[side=right]:sm:max-w-none!",
        )}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-2">
          <Tabs
            value={view}
            onValueChange={(value) => setView(value as View)}
            className="shrink-0"
          >
            <TabsList className="h-fit! px-1!">
              <TabsTrigger
                className="size-7"
                value="preview"
                aria-label="Preview"
                title="Preview"
              >
                <IconEye className="size-3.5" />
              </TabsTrigger>
              <TabsTrigger
                className="size-7"
                value="code"
                aria-label="Code"
                title="Code"
              >
                <IconCode className="size-3.5" />
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
            <SheetTitle className="truncate text-sm font-medium">
              {artifact.title}
            </SheetTitle>
            <span className="shrink-0 text-sm text-muted-foreground">
              · {typeLabel}
            </span>
            <SheetDescription className="sr-only">
              {typeLabel} artifact preview and source code
            </SheetDescription>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <ButtonGroup>
              <Button variant="secondary" size="sm" onClick={handleCopy}>
                {copied && <IconCheck />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <ButtonGroupSeparator />
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="More actions"
                  className={buttonVariants({
                    variant: "secondary",
                    size: "icon-sm",
                  })}
                >
                  <IconChevronDown className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={handleDownload}>
                    Download as {typeLabel}
                  </DropdownMenuItem>
                  {onPublish && (
                    <DropdownMenuItem onClick={() => onPublish(artifact)}>
                      Publish artifact
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>

            <Button
              variant="secondary"
              size="icon-sm"
              onClick={() => setMaximized((v) => !v)}
              aria-label={maximized ? "Restore size" : "Expand"}
              title={maximized ? "Restore" : "Expand"}
              className="hidden sm:flex"
            >
              {maximized ? (
                <IconArrowsDiagonalMinimize2 />
              ) : (
                <IconArrowsDiagonal />
              )}
            </Button>

            <Button
              variant="secondary"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              title="Close"
            >
              <IconX />
            </Button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            className={cn(
              "min-h-0 flex-1 overflow-hidden bg-background",
              view !== "preview" && "hidden",
            )}
          >
            {artifact.type === "html" && (
              <HtmlSandbox
                code={artifact.content}
                className="size-full border-0 bg-background"
              />
            )}
            {artifact.type === "svg" && (
              <SvgSandbox
                svg={artifact.content}
                className="flex size-full items-center justify-center overflow-auto border-0 bg-background p-6 [&_svg]:max-h-full [&_svg]:max-w-full"
              />
            )}
            {artifact.type === "mermaid" && (
              <MermaidSandbox
                code={artifact.content}
                className="flex size-full items-center justify-center overflow-auto border-0 bg-background p-6 [&_svg]:max-h-full [&_svg]:max-w-full"
              />
            )}
          </div>

          <div
            className={cn(
              "min-h-0 flex-1 overflow-auto bg-sidebar py-4 font-mono text-[13px] leading-6 [scrollbar-width:thin]",
              view !== "code" && "hidden",
            )}
          >
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((tokens, i) => (
                  <tr key={i} className="align-top">
                    <td className="w-14 min-w-14 pr-4 text-right text-muted-foreground/50 select-none">
                      {i + 1}
                    </td>
                    <td className="pr-6 [overflow-wrap:anywhere] whitespace-pre-wrap text-foreground">
                      {tokens.length === 0
                        ? " "
                        : tokens.map((token, j) => (
                            <span key={j} className={token.cls}>
                              {token.text}
                            </span>
                          ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
