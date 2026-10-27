"use client"

import { Button } from "@openbots/ui/components/button"
import { Spinner } from "@openbots/ui/components/spinner"
import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export function MarkdownDocumentViewer({
  source,
  content: initialContent,
  title: _title,
  ext,
  onDownload,
}: {
  source?: string
  content?: string
  title: string
  ext: string
  onDownload: () => void
}) {
  const [text, setText] = React.useState<string>(initialContent || "")
  const [loading, setLoading] = React.useState<boolean>(
    !initialContent && !!source
  )
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (initialContent) {
      setText(initialContent)
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
          setText(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Failed to load document content")
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [source, initialContent])

  return (
    <div className="size-full overflow-auto rounded-2xl bg-card px-6 py-8 sm:px-12 sm:py-10">
      <div className="mx-auto max-w-3xl select-text">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
              <Spinner />
              <span>Opening document...</span>
            </div>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            <p className="mb-3 font-medium text-destructive">{error}</p>
            <Button size="sm" onClick={onDownload}>
              Download {ext.toUpperCase()}
            </Button>
          </div>
        ) : (
          <div className="typeset">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
