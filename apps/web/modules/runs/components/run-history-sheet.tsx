"use client"

import { Button } from "@openbots/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@openbots/ui/components/sheet"
import { Spinner } from "@openbots/ui/components/spinner"
import { IconChevronRight, IconHistory } from "@tabler/icons-react"
import * as React from "react"
import { useAgentStream } from "@/modules/agents/hooks/use-agent-stream"
import { useRunsQuery } from "../queries"
import { formatDuration, formatTimestamp, getInputText } from "../utils"
import { RunDetailView } from "./run-detail-view"
import { RunStatusBadge } from "./run-status-badge"

interface RunHistorySheetProps {
  agentId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedRunId?: string | null
  onSelectRunId?: (runId: string | null) => void
}

const SCROLL_CLASS =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain " +
  "[scrollbar-gutter:stable] [scrollbar-width:thin] " +
  "[scrollbar-color:color-mix(in_oklab,currentColor_25%,transparent)_transparent]"

export function RunHistorySheet({
  agentId,
  open,
  onOpenChange,
  selectedRunId: externalSelectedRunId,
  onSelectRunId,
}: RunHistorySheetProps) {
  const [internalRunId, setInternalRunId] = React.useState<string | null>(null)

  const activeRunId =
    externalSelectedRunId !== undefined ? externalSelectedRunId : internalRunId

  const handleSelectRun = React.useCallback(
    (id: string | null) => {
      if (onSelectRunId) {
        onSelectRunId(id)
      } else {
        setInternalRunId(id)
      }
    },
    [onSelectRunId]
  )

  // Connect live SSE stream for real-time run updates when sheet is open
  useAgentStream({
    agentId,
    enabled: open,
  })

  const {
    data: runs = [],
    isLoading,
    refetch,
  } = useRunsQuery(agentId, {
    enabled: open,
    refetchInterval: false,
  })

  React.useEffect(() => {
    if (!open) {
      handleSelectRun(null)
    }
    refetch()
  }, [open, handleSelectRun])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col sm:max-w-md!">
        <SheetHeader>
          <SheetTitle>Execution history</SheetTitle>
          <SheetDescription>
            Audit all tool invocations, prompts, and outputs triggered by this
            agent.
          </SheetDescription>
        </SheetHeader>

        <div className={`px-4 pb-6 ${SCROLL_CLASS}`}>
          {activeRunId ? (
            <RunDetailView
              runId={activeRunId}
              agentId={agentId}
              onBack={() => handleSelectRun(null)}
            />
          ) : isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Spinner className="size-5" />
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center text-xs text-muted-foreground">
              <IconHistory className="mb-2 size-8 stroke-1 text-muted-foreground/50" />
              No runs recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {runs.map((run) => {
                const preview = getInputText(run.input, "Agent run")
                const duration = formatDuration(
                  run.startedAt ?? run.createdAt,
                  run.completedAt
                )

                return (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => handleSelectRun(run.id)}
                    className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <RunStatusBadge status={run.status} />
                        <span className="text-[11px] text-muted-foreground">
                          {duration !== "—" ? `· ${duration}` : ""}
                        </span>
                      </div>

                      <p className="mt-1 line-clamp-1 font-mono text-xs text-foreground">
                        {preview}
                      </p>

                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatTimestamp(run.startedAt ?? run.createdAt)}
                      </p>
                    </div>

                    <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
