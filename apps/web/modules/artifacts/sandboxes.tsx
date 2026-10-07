"use client";

import { useTheme } from "next-themes";
import * as React from "react";
import { svgDocument, withDesignSystem } from "./theme";

type ThemeName = "light" | "dark";

function useIframeTheme(): ThemeName {
  const { resolvedTheme } = useTheme();

  return resolvedTheme === "dark" ? "dark" : "light";
}

const MERMAID_THEME_VARIABLES: Record<ThemeName, Record<string, string>> = {
  light: {
    background: "transparent",
    primaryColor: "#f5f5f5",
    primaryTextColor: "#0a0a0a",
    primaryBorderColor: "#d4d4d4",
    secondaryColor: "#ffffff",
    tertiaryColor: "#fcfcfb",
    lineColor: "#737373",
    textColor: "#0a0a0a",
    noteBkgColor: "#f5f5f5",
    noteTextColor: "#0a0a0a",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    fontSize: "13px",
  },

  dark: {
    background: "transparent",
    primaryColor: "#262626",
    primaryTextColor: "#fafafa",
    primaryBorderColor: "#404040",
    secondaryColor: "#171717",
    tertiaryColor: "#0a0a0a",
    lineColor: "#a3a3a3",
    textColor: "#fafafa",
    noteBkgColor: "#262626",
    noteTextColor: "#fafafa",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    fontSize: "13px",
  },
};

/* -------------------------------------------------------------------------- */
/* SVG                                                                        */
/* -------------------------------------------------------------------------- */

function parseViewBoxRatio(svg: string): string | null {
  const match = svg.match(
    /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i,
  );

  if (!match) {
    return null;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  return width > 0 && height > 0 ? `${width} / ${height}` : null;
}

/* -------------------------------------------------------------------------- */
/* HTML                                                                       */
/* -------------------------------------------------------------------------- */

interface HtmlSandboxProps {
  code: string;
  className?: string;
  fitContent?: boolean;
  initialWidth?: number;
  maxWidth?: number;
  isStreaming?: boolean;
}

export function HtmlSandbox({
  code,
  className,
  fitContent = false,
  initialWidth = 760,
  maxWidth = 820,
  isStreaming = false,
}: HtmlSandboxProps) {
  const theme = useIframeTheme();

  // Debounce the code during streaming so the iframe doesn't flicker or reload on every single token
  const [debouncedCode, setDebouncedCode] = React.useState(code);

  React.useEffect(() => {
    if (!isStreaming) {
      setDebouncedCode(code);
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedCode(code);
    }, 250);

    return () => clearTimeout(timer);
  }, [code, isStreaming]);

  const activeCode = isStreaming ? debouncedCode : code;

  const srcDoc = React.useMemo(() => {
    const document = withDesignSystem(activeCode, theme);

    if (!fitContent) {
      return document;
    }

    const reset = `
      <style>
        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
        }

        html {
          width: 100%;
        }

        body {
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
          box-sizing: border-box;
        }

        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }
      </style>
    `;

    const measurementScript = `
      <script>
        (() => {
          const sendSize = () => {
            const body = document.body
            const html = document.documentElement

            if (!body || !html) return

            const width = Math.max(
              body.scrollWidth,
              body.offsetWidth,
              html.scrollWidth,
              html.offsetWidth
            )

            const height = Math.max(
              body.scrollHeight,
              body.offsetHeight,
              html.scrollHeight,
              html.offsetHeight
            )

            window.parent.postMessage(
              {
                type: "openbots-artifact-size",
                width,
                height
              },
              "*"
            )
          }

          window.addEventListener("load", () => {
            requestAnimationFrame(sendSize)
          })

          if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(() => {
              requestAnimationFrame(sendSize)
            })

            observer.observe(document.documentElement)

            if (document.body) {
              observer.observe(document.body)
            }
          }

          requestAnimationFrame(sendSize)
          setTimeout(sendSize, 100)
          setTimeout(sendSize, 500)
        })()
      </script>
    `;

    let result = document;

    if (result.includes("</head>")) {
      result = result.replace("</head>", `${reset}</head>`);
    } else {
      result = `${reset}${result}`;
    }

    if (result.includes("</body>")) {
      result = result.replace("</body>", `${measurementScript}</body>`);
    } else {
      result += measurementScript;
    }

    return result;
  }, [activeCode, theme, fitContent]);

  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const [size, setSize] = React.useState<{
    width: number;
    height: number;
  } | null>(null);

  React.useEffect(() => {
    if (!fitContent) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const data = event.data;

      if (!data || data.type !== "openbots-artifact-size") {
        return;
      }

      const width = Number(data.width);
      const height = Number(data.height);

      if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
      ) {
        return;
      }

      setSize({
        width: Math.min(width, maxWidth),
        height,
      });
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [fitContent, maxWidth]);

  if (fitContent) {
    const width = Math.min(size?.width ?? initialWidth, maxWidth);

    const height = size?.height ?? 1;

    return (
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-modals allow-forms"
        scrolling="no"
        title="Artifact Sandbox"
        className={className}
        style={{
          display: "block",
          width: `${width}px`,
          height: `${height}px`,
          maxWidth: "100%",
          border: 0,
          overflow: "hidden",
        }}
      />
    );
  }

  return (
    <div
      className={
        className ??
        "flex h-full min-h-[400px] w-full flex-col overflow-hidden rounded-md border border-border bg-background"
      }
    >
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-modals allow-forms"
        className="size-full flex-1 border-0"
        title="Artifact Sandbox"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SVG                                                                        */
/* -------------------------------------------------------------------------- */

export function SvgSandbox({
  svg,
  className,
  isStreaming = false,
}: {
  svg: string;
  className?: string;
  isStreaming?: boolean;
}) {
  const theme = useIframeTheme();

  const [debouncedSvg, setDebouncedSvg] = React.useState(svg);

  React.useEffect(() => {
    if (!isStreaming) {
      setDebouncedSvg(svg);
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedSvg(svg);
    }, 250);

    return () => clearTimeout(timer);
  }, [svg, isStreaming]);

  const activeSvg = isStreaming ? debouncedSvg : svg;

  const srcDoc = React.useMemo(
    () => svgDocument(activeSvg, theme),
    [activeSvg, theme],
  );

  const aspectRatio = React.useMemo(
    () => parseViewBoxRatio(activeSvg),
    [activeSvg],
  );

  return (
    <div
      className={
        className ??
        "flex h-full min-h-[400px] w-full items-center justify-center overflow-hidden rounded-md border border-border bg-background"
      }
    >
      <iframe
        srcDoc={srcDoc}
        sandbox=""
        scrolling="no"
        title="SVG artifact"
        className="max-h-full w-full border-0 bg-transparent"
        style={
          aspectRatio
            ? {
                aspectRatio,
              }
            : {
                height: "100%",
                minHeight: 240,
              }
        }
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mermaid                                                                    */
/* -------------------------------------------------------------------------- */

export function MermaidSandbox({
  code,
  className,
  isStreaming = false,
}: {
  code: string;
  className?: string;
  isStreaming?: boolean;
}) {
  const theme = useIframeTheme();

  const containerRef = React.useRef<HTMLDivElement>(null);

  const [error, setError] = React.useState<string | null>(null);

  const baseId = React.useId().replace(/:/g, "");

  const renderCount = React.useRef(0);

  React.useEffect(() => {
    let isMounted = true;

    async function renderMermaid() {
      if (!containerRef.current) {
        return;
      }

      try {
        setError(null);

        const mermaid = (await import("mermaid")).default;

        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: MERMAID_THEME_VARIABLES[theme],
          securityLevel: "strict",
        });

        renderCount.current += 1;

        const { svg } = await mermaid.render(
          `mermaid-${baseId}-${renderCount.current}`,
          code,
        );

        if (isMounted && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to render Mermaid diagram",
          );
        }
      }
    }

    renderMermaid();

    return () => {
      isMounted = false;
    };
  }, [code, theme, baseId]);

  if (error) {
    if (isStreaming) {
      return (
        <div
          className={
            className ??
            "flex h-full min-h-[300px] w-full flex-col items-center justify-center gap-2 rounded-md border border-border bg-muted/20 p-4 text-xs text-muted-foreground"
          }
        >
          <div className="flex items-center gap-2 text-primary">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
            <p className="font-medium">Rendering diagram live...</p>
          </div>
          <p className="text-[11px] opacity-70">
            Updating as diagram syntax completes
          </p>
        </div>
      );
    }

    return (
      <div
        className={
          className ??
          "flex h-full min-h-[300px] w-full flex-col items-center justify-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive"
        }
      >
        <p className="font-medium">Diagram syntax error</p>

        <pre className="max-w-full overflow-x-auto text-[11px] opacity-80">
          {error}
        </pre>
      </div>
    );
  }

  return (
    <div
      className={
        className ??
        "flex h-full min-h-[400px] w-full items-center justify-center overflow-auto rounded-md border border-border bg-background p-6"
      }
    >
      <div
        ref={containerRef}
        className="max-h-full max-w-full [&_svg]:h-auto [&_svg]:max-h-full [&_svg]:max-w-full"
      />
    </div>
  );
}
