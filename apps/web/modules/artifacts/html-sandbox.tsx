"use client"

import * as React from "react"
import { useIframeTheme } from "./sandboxes-common"
import { withDesignSystem } from "./theme"

export interface HtmlSandboxProps {
  code: string
  className?: string
  fitContent?: boolean
  initialWidth?: number
  maxWidth?: number
  isStreaming?: boolean
}

export function HtmlSandbox({
  code,
  className,
  fitContent = false,
  initialWidth = 760,
  maxWidth = 820,
  isStreaming = false,
}: HtmlSandboxProps) {
  const theme = useIframeTheme()

  // Debounce the code during streaming so the iframe doesn't flicker or reload on every single token
  const [debouncedCode, setDebouncedCode] = React.useState(code)

  React.useEffect(() => {
    if (!isStreaming) {
      setDebouncedCode(code)
      return
    }

    const timer = setTimeout(() => {
      setDebouncedCode(code)
    }, 400)

    return () => clearTimeout(timer)
  }, [code, isStreaming])

  const activeCode = isStreaming ? debouncedCode : code

  const srcDoc = React.useMemo(() => {
    const document = withDesignSystem(activeCode, theme)

    if (!fitContent) {
      return document
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
    `

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
    `

    let result = document

    if (result.includes("</head>")) {
      result = result.replace("</head>", `${reset}</head>`)
    } else {
      result = `${reset}${result}`
    }

    if (result.includes("</body>")) {
      result = result.replace("</body>", `${measurementScript}</body>`)
    } else {
      result += measurementScript
    }

    return result
  }, [activeCode, theme, fitContent])

  const iframeRef = React.useRef<HTMLIFrameElement>(null)

  const [size, setSize] = React.useState<{
    width: number
    height: number
  } | null>(null)

  React.useEffect(() => {
    if (!fitContent) return

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return
      }

      const data = event.data

      if (!data || data.type !== "openbots-artifact-size") {
        return
      }

      const width = Number(data.width)
      const height = Number(data.height)

      if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
      ) {
        return
      }

      setSize({
        width: Math.min(width, maxWidth),
        height,
      })
    }

    window.addEventListener("message", handleMessage)

    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [fitContent, maxWidth])

  if (fitContent) {
    const width = Math.min(size?.width ?? initialWidth, maxWidth)

    // Don't collapse to 1px while loading or streaming, maintain minimum comfortable container height
    const height = size?.height ?? (isStreaming ? 180 : 80)

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
          minHeight: isStreaming ? "120px" : undefined,
          maxWidth: "100%",
          border: 0,
          overflow: "hidden",
          transition: "height 0.15s ease-out",
        }}
      />
    )
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
  )
}
