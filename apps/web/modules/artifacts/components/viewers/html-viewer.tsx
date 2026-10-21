"use client"

import { Button } from "@openbots/ui/components/button"
import * as React from "react"
import { HtmlSandbox } from "../../html-sandbox"

export function HtmlDocumentViewer({
  source,
  content: initialContent,
  onDownload,
}: {
  source?: string
  content?: string
  title: string
  ext: string
  onDownload: () => void
}) {
  const [html, setHtml] = React.useState<string>(initialContent || "")
  const [loading, setLoading] = React.useState<boolean>(
    !initialContent && !!source
  )
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (initialContent) {
      setHtml(initialContent)
      setLoading(false)
      return
    }

    if (!source) {
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError(null)

    fetch(source)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load file`)
        return res.text()
      })
      .then((data) => {
        if (active) {
          setHtml(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Failed to load HTML content")
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [source, initialContent])

  if (loading) {
    return (
      <div className="flex size-full items-center justify-center bg-background py-20">
        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Loading HTML document...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex size-full flex-col items-center justify-center bg-background p-8 text-center text-xs text-muted-foreground">
        <p className="mb-3 font-medium text-destructive">{error}</p>
        <Button size="sm" onClick={onDownload}>
          Download HTML
        </Button>
      </div>
    )
  }

  return (
    <div className="size-full overflow-hidden">
      <HtmlSandbox code={html} className="size-full border-0 bg-sidebar" />
    </div>
  )
}
