"use client"

import { Button } from "@openbots/ui/components/button"
import { ScrollArea } from "@openbots/ui/components/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@openbots/ui/components/sheet"
import { Spinner } from "@openbots/ui/components/spinner"
import {
  IconArrowLeft,
  IconChevronRight,
  IconHistory,
  IconPlayerStop,
} from "@tabler/icons-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { getClient } from "@/lib/api"
import { ExecutionStepsCard, type StepItem } from "./execution-steps-card"

export type RunRecord = {
  id: string
  userId: string
  agentId: string
  conversationId: string | null
  status:
    "queued" | "running" | "waiting" | "completed" | "failed" | "cancelled"
  triggerType: string
  input: unknown
  output: unknown
  error: string | null
  startedAt: string | Date | null
  completedAt: string | Date | null
  createdAt: string | Date
}

interface RunHistorySheetProps {
  agentId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedRunId?: string | null
  onSelectRunId?: (runId: string | null) => void
}

/* ---------- helpers ---------- */

function formatTimestamp(dateVal: string | Date | null | undefined): string {
  if (!dateVal) return "—"
  try {
    return new Date(dateVal).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  } catch {
    return String(dateVal)
  }
}

function formatDuration(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): string {
  if (!start || !end) return "—"
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (Number.isNaN(ms) || ms < 0) return "—"
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}

function toText(value: unknown, keys: string[], fallback = ""): string {
  if (value === null || value === undefined) return fallback
  if (typeof value === "string") return value
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    for (const key of keys) {
      if (typeof obj[key] === "string") return obj[key] as string
    }
    return JSON.stringify(obj, null, 2)
  }
  return String(value)
}

const getInputText = (input: unknown, fallback = "") =>
  toText(input, ["prompt", "text"], fallback)
const getOutputText = (output: unknown) => toText(output, ["text"])

const STATUS_META: Record<
  RunRecord["status"],
  { label: string; dot: string; text: string }
> = {
  completed: {
    label: "Completed",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  running: { label: "Running", dot: "", text: "text-foreground" },
  queued: {
    label: "Queued",
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
  },
  waiting: {
    label: "Waiting",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
  },
  failed: {
    label: "Failed",
    dot: "bg-destructive",
    text: "text-destructive",
  },
}

function StatusLabel({ status }: { status: RunRecord["status"] }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.text}`}
    >
      {status === "running" ? (
        <Spinner className="size-3" />
      ) : (
        <span className={`size-1.5 rounded-full ${meta.dot}`} />
      )}
      {meta.label}
    </span>
  )
}

const Markdown = React.memo(function Markdown({
  children,
}: {
  children: string
}) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
})

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-medium text-muted-foreground">
      {children}
    </h3>
  )
}

/* ---------- component ---------- */

export function RunHistorySheet({
  agentId,
  open,
  onOpenChange,
  selectedRunId: externalSelectedRunId,
  onSelectRunId: externalOnSelectRunId,
}: RunHistorySheetProps) {
  const queryClient = useQueryClient()
  const [internalRunId, setInternalRunId] = React.useState<string | null>(null)

  const inspectedRunId =
    externalSelectedRunId !== undefined ? externalSelectedRunId : internalRunId
  const setInspectedRunId = externalOnSelectRunId || setInternalRunId

  const { data: runsData, isLoading: isLoadingRuns } = useQuery({
    queryKey: ["runs", agentId],
    queryFn: async () => {
      if (!agentId) return { runs: [] }
      const client = getClient()
      const res = await client.api.runs.$get({ query: { agentId } })
      if (!res.ok) throw new Error("Failed to fetch runs")
      return res.json() as Promise<{ runs: RunRecord[] }>
    },
    enabled: open && !!agentId,
  })

  const { data: inspectedRunData, isLoading: isLoadingInspected } = useQuery({
    queryKey: ["run", inspectedRunId],
    queryFn: async () => {
      if (!inspectedRunId) return null
      const client = getClient()
      const res = await client.api.runs[":id"].$get({
        param: { id: inspectedRunId },
      })
      if (!res.ok) throw new Error("Failed to fetch run details")
      return res.json() as Promise<{ run: RunRecord; steps: StepItem[] }>
    },
    enabled: open && !!inspectedRunId,
    refetchInterval: (query) => {
      const status = query.state.data?.run?.status
      return status === "queued" || status === "running" ? 1500 : false
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async (runId: string) => {
      const client = getClient()
      const res = await client.api.runs[":id"].cancel.$post({
        param: { id: runId },
      })
      if (!res.ok) throw new Error("Failed to cancel run")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["run", inspectedRunId] })
      queryClient.invalidateQueries({ queryKey: ["runs", agentId] })
    },
  })

  const run = inspectedRunData?.run
  const steps = inspectedRunData?.steps || []
  const isInspectedActive =
    run?.status === "queued" || run?.status === "running"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-2">
            {inspectedRunId && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setInspectedRunId(null)}
                aria-label="Back to history"
              >
                <IconArrowLeft className="size-4" />
              </Button>
            )}
            <SheetTitle>
              {inspectedRunId ? "Run details" : "Run history"}
            </SheetTitle>
          </div>
          <SheetDescription>
            {inspectedRunId
              ? "See the task, each tool step, and the final response."
              : "Past and active runs for this agent."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col px-4">
          <ScrollArea className="min-h-0 flex-1">
            <div className="pb-4">
              {inspectedRunId ? (
                isLoadingInspected ? (
                  <div className="flex items-center justify-center p-8">
                    <Spinner className="size-5" />
                  </div>
                ) : !run ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    Run not found.
                  </p>
                ) : (
                  <div className="space-y-6">
                    {/* Summary */}
                    <dl className="divide-y divide-border overflow-hidden rounded-xl border border-border text-xs">
                      <div className="flex items-center justify-between px-3.5 py-2.5">
                        <dt className="text-muted-foreground">Status</dt>
                        <dd>
                          <StatusLabel status={run.status} />
                        </dd>
                      </div>
                      <div className="flex items-center justify-between px-3.5 py-2.5">
                        <dt className="text-muted-foreground">Started</dt>
                        <dd className="text-foreground">
                          {formatTimestamp(run.startedAt || run.createdAt)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between px-3.5 py-2.5">
                        <dt className="text-muted-foreground">Finished</dt>
                        <dd className="text-foreground">
                          {formatTimestamp(run.completedAt)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between px-3.5 py-2.5">
                        <dt className="text-muted-foreground">Duration</dt>
                        <dd className="text-foreground">
                          {formatDuration(
                            run.startedAt || run.createdAt,
                            run.completedAt
                          )}
                        </dd>
                      </div>
                    </dl>

                    {/* Task */}
                    <section>
                      <SectionLabel>Task</SectionLabel>
                      <div className="rounded-xl bg-muted px-3.5 py-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                        {getInputText(run.input)}
                      </div>
                    </section>

                    {/* Steps */}
                    <section>
                      <SectionLabel>
                        Steps{steps.length > 0 && ` (${steps.length})`}
                      </SectionLabel>
                      <ExecutionStepsCard
                        steps={steps}
                        isLive={isInspectedActive}
                      />
                    </section>

                    {/* Error */}
                    {Boolean(run.error) && (
                      <section>
                        <SectionLabel>Error</SectionLabel>
                        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-destructive">
                          {run.error}
                        </div>
                      </section>
                    )}

                    {/* Response */}
                    {Boolean(run.output) && (
                      <section>
                        <SectionLabel>Response</SectionLabel>
                        <div className="rounded-xl border border-border px-3.5 py-3">
                          <div className="typeset typeset-chat text-sm text-foreground">
                            <Markdown>{getOutputText(run.output)}</Markdown>
                          </div>
                        </div>
                      </section>
                    )}
                  </div>
                )
              ) : isLoadingRuns ? (
                <div className="flex items-center justify-center p-8">
                  <Spinner className="size-5" />
                </div>
              ) : !runsData?.runs?.length ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-xs text-muted-foreground">
                  No runs yet. Send this agent a task and it will show up here.
                </div>
              ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {runsData.runs.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setInspectedRunId(r.id)}
                        className="group flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <StatusLabel status={r.status} />
                            <span className="text-[11px] text-muted-foreground">
                              {formatTimestamp(r.createdAt)}
                            </span>
                          </div>
                          <p className="line-clamp-2 text-sm text-foreground">
                            {getInputText(r.input, "Manual run")}
                          </p>
                        </div>
                        <IconChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </ScrollArea>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {inspectedRunId && isInspectedActive && run && (
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate(run.id)}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <Spinner className="size-3.5" />
              ) : (
                <IconPlayerStop className="size-3.5" />
              )}
              Cancel run
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
