"use client"

import { Button } from "@openbots/ui/components/button"
import { IconDownload, IconFileSpreadsheet } from "@tabler/icons-react"
import * as React from "react"
import { cn } from "@/lib/utils"

export function SpreadsheetViewer({
  source,
  content,
  ext,
  onDownload,
}: {
  source?: string
  content?: string
  ext: string
  onDownload: () => void
}) {
  const [data, setData] = React.useState<any[][]>([])
  const [sheetNames, setSheetNames] = React.useState<string[]>([])
  const [activeSheet, setActiveSheet] = React.useState<string>("")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true

    async function parseSpreadsheet() {
      setLoading(true)
      setError(null)

      try {
        const XLSX = await import("xlsx")
        let workbook: any = null

        if (source) {
          const res = await fetch(source)
          if (!res.ok)
            throw new Error(`HTTP ${res.status}: Failed to fetch file`)
          const ab = await res.arrayBuffer()
          workbook = XLSX.read(ab, { type: "array" })
        } else if (content) {
          workbook = XLSX.read(content, { type: "string" })
        }

        if (!workbook || !workbook.SheetNames?.length) {
          throw new Error("No sheet data found")
        }

        if (!active) return
        setSheetNames(workbook.SheetNames)
        const firstSheet = workbook.SheetNames[0]
        setActiveSheet(firstSheet)
        const sheet = workbook.Sheets[firstSheet]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
        setData(rows)
        setLoading(false)
      } catch (err: any) {
        if (!active) return
        setError(err?.message || "Failed to parse spreadsheet")
        setLoading(false)
      }
    }

    parseSpreadsheet()

    return () => {
      active = false
    }
  }, [source, content])

  if (loading) {
    return (
      <div className="flex size-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Loading spreadsheet...</span>
        </div>
      </div>
    )
  }

  if (error || !data.length) {
    return (
      <div className="flex size-full flex-col items-center justify-center p-6 text-center">
        <IconFileSpreadsheet className="size-10 text-emerald-600 dark:text-emerald-400" />
        <p className="mt-2 text-sm font-medium text-foreground">
          Unable to preview spreadsheet data directly
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        <Button size="sm" className="mt-4" onClick={onDownload}>
          <IconDownload className="mr-1.5 size-4" />
          Download {ext.toUpperCase()}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex size-full flex-col overflow-hidden bg-background">
      {sheetNames.length > 1 && (
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-muted/30 px-3 py-1.5">
          {sheetNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveSheet(name)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                activeSheet === name
                  ? "border border-border bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-4 select-text">
        <table className="w-full border-collapse text-left font-mono text-xs">
          <tbody>
            {data.map((row, rIdx) => (
              <tr
                key={rIdx}
                className={cn(
                  "border-b border-border/60 transition-colors hover:bg-muted/20",
                  rIdx === 0 &&
                    "sticky top-0 bg-muted/40 font-semibold text-foreground"
                )}
              >
                <td className="w-10 border-r border-border/40 bg-muted/20 px-2 py-1.5 text-center text-[10px] text-muted-foreground select-none">
                  {rIdx + 1}
                </td>
                {Array.isArray(row) &&
                  row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className="max-w-xs truncate border-r border-border/40 px-3 py-1.5"
                    >
                      {cell !== undefined && cell !== null ? String(cell) : ""}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
