"use client"

import * as React from "react"
import { parseViewBoxRatio, useIframeTheme } from "./sandboxes-common"
import { svgDocument } from "./theme"

export function SvgSandbox({
  svg,
  className,
  isStreaming = false,
}: {
  svg: string
  className?: string
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
    }, 250)

    return () => clearTimeout(timer)
  }, [svg, isStreaming])

  const activeSvg = isStreaming ? debouncedSvg : svg

  const srcDoc = React.useMemo(
    () => svgDocument(activeSvg, theme),
    [activeSvg, theme]
  )

  const aspectRatio = React.useMemo(
    () => parseViewBoxRatio(activeSvg),
    [activeSvg]
  )

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
  )
}
