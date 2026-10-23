"use client"

import * as React from "react"
import { MERMAID_THEME_VARIABLES, useIframeTheme } from "./sandboxes-common"

export function MermaidSandbox({
  code,
  className,
  isStreaming = false,
}: {
  code: string
  className?: string
  isStreaming?: boolean
}) {
  const theme = useIframeTheme()

  const containerRef = React.useRef<HTMLDivElement>(null)

  const [error, setError] = React.useState<string | null>(null)

  const baseId = React.useId().replace(/:/g, "")

  const renderCount = React.useRef(0)

  React.useEffect(() => {
    let isMounted = true

    async function renderMermaid() {
      if (!containerRef.current) {
        return
      }

      try {
        setError(null)

        const mermaid = (await import("mermaid")).default

        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: MERMAID_THEME_VARIABLES[theme],
          securityLevel: "strict",
        })

        renderCount.current += 1

        const { svg } = await mermaid.render(
          `mermaid-${baseId}-${renderCount.current}`,
          code
        )

        if (isMounted && containerRef.current) {
          containerRef.current.innerHTML = svg
          const svgEl = containerRef.current.querySelector("svg")
          if (svgEl) {
            svgEl.removeAttribute("height")
            svgEl.style.width = "100%"
            svgEl.style.maxWidth = "100%"
            svgEl.style.height = "auto"
          }
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to render Mermaid diagram"
          )
        }
      }
    }

    renderMermaid()

    return () => {
      isMounted = false
    }
  }, [code, theme, baseId])

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
      )
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
    )
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
        className="w-full max-w-full overflow-x-auto py-2 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-full"
      />
    </div>
  )
}
