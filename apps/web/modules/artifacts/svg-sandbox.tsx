"use client"

import * as React from "react"
import { parseViewBoxRatio, useIframeTheme } from "./sandboxes-common"
import { svgDocument } from "./theme"

export function SvgSandbox({
  svg,
  className,
  fitContent = false,
  isStreaming = false,
}: {
  svg: string
  className?: string
  fitContent?: boolean
  isStreaming?: boolean
}) {
  const theme = useIframeTheme()

  const [debouncedSvg, setDebouncedSvg] = React.useState(svg)

  React.useEffect(() => {
    if (!isStreaming) {
      setDebouncedSvg(svg)
      return
    }

    const timer = setTimeout(() => {
      setDebouncedSvg(svg)
    }, 400)

    return () => clearTimeout(timer)
  }, [svg, isStreaming])

  const activeSvg = isStreaming ? debouncedSvg : svg

  const srcDoc = React.useMemo(
    () => svgDocument(activeSvg, theme, fitContent),
    [activeSvg, theme, fitContent]
  )

  const aspectRatio = React.useMemo(
    () => parseViewBoxRatio(activeSvg),
    [activeSvg]
  )

  const inlineStyle: React.CSSProperties = fitContent
    ? {
        width: "100%",
        height: "auto",
        aspectRatio: aspectRatio ?? undefined,
        minHeight: isStreaming ? "120px" : "fit-content",
        display: "block",
      }
    : aspectRatio
      ? { aspectRatio }
      : { height: "100%", minHeight: 240 }

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
        className={
          fitContent
            ? "block w-full max-w-full border-0 bg-transparent transition-all"
            : "max-h-full w-full border-0 bg-transparent"
        }
        style={inlineStyle}
      />
    </div>
  )
}
