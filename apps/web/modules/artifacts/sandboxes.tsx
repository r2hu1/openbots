"use client";

import * as React from "react";

export function HtmlSandbox({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  // Construct clean self-contained HTML document with Tailwind CDN
  const srcDoc = React.useMemo(() => {
    if (code.includes("<html") || code.includes("<!DOCTYPE")) {
      return code;
    }
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      margin: 0;
      padding: 1rem;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }
  </style>
</head>
<body class="bg-background text-foreground antialiased">
  ${code}
</body>
</html>`;
  }, [code]);

  return (
    <div
      className={
        className ||
        "flex h-full min-h-[400px] w-full flex-col overflow-hidden rounded-md border border-border bg-background"
      }
    >
      <iframe
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-modals allow-forms"
        className="size-full flex-1 border-0"
        title="Artifact Sandbox"
      />
    </div>
  );
}

export function SvgSandbox({
  svg,
  className,
}: {
  svg: string;
  className?: string;
}) {
  return (
    <div
      className={
        className ||
        "flex h-full min-h-[400px] w-full items-center justify-center overflow-auto rounded-md border border-border bg-background p-6"
      }
    >
      <div
        className="max-h-full max-w-full [&_svg]:h-auto [&_svg]:max-h-full [&_svg]:max-w-full"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Sandboxed vector artifact rendering
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

export function MermaidSandbox({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    async function renderMermaid() {
      if (!containerRef.current) return;
      try {
        setError(null);
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
        });

        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, code);
        if (isMounted && containerRef.current) {
          containerRef.current.innerHTML = svg;
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
  }, [code]);

  if (error) {
    return (
      <div className="flex h-full min-h-[300px] w-full flex-col items-center justify-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive">
        <p className="font-medium">Diagram Syntax Error</p>
        <pre className="max-w-full overflow-x-auto text-[11px] opacity-80">
          {error}
        </pre>
      </div>
    );
  }

  return (
    <div
      className={
        className ||
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
