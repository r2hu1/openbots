"use client"

import { Button } from "@openbots/ui/components/button"
import { Spinner } from "@openbots/ui/components/spinner"
import { IconArrowLeft, IconPlayerStop } from "@tabler/icons-react"
import { Markdown } from "@/components/shared/markdown"
import { useQueryClient } from "@tanstack/react-query"
import { useRunStream } from "../hooks/use-run-stream"
import { runKeys, useCancelRunMutation, useRunDetailQuery } from "../queries"
import {
  formatDuration,
  formatTimestamp,
  getInputText,
  getOutputText,
} from "../utils"
import { ExecutionStepsCard } from "./execution-steps-card"
import { RunStatusBadge } from "./run-status-badge"

interface RunDetailViewProps {
  runId: string
  agentId: string | null
  onBack: () => void
}

export function RunDetailView({ runId, agentId, onBack }: RunDetailViewProps) {
  const queryClient = useQueryClient()
  const { data, isLoading } = useRunDetailQuery(runId, {
    refetchInterval: false,
  })

  const isRunning =
    data?.run?.status === "queued" || data?.run?.status === "running"

  const {
    streamingText,
    streamingSteps,
    status: streamStatus,
  } = useRunStream({
    runId: isRunning ? runId : null,
    onDone: () => {
      queryClient.invalidateQueries({ queryKey: runKeys.detail(runId) })
      if (agentId) {
        queryClient.invalidateQueries({ queryKey: runKeys.byAgent(agentId) })
      }
    },
    onStatus: (st) => {
      if (
        st.status === "completed" ||
        st.status === "failed" ||
        st.status === "cancelled"
      ) {
        queryClient.invalidateQueries({ queryKey: runKeys.detail(runId) })
        if (agentId) {
          queryClient.invalidateQueries({ queryKey: runKeys.byAgent(agentId) })
        }
      }
    },
  })

  const cancelMutation = useCancelRunMutation(agentId)

  if (isLoading || !data) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Spinner className="size-5" />
      </div>
    )
  }

  const { run, steps } = data
  const currentStatus = streamStatus || run.status
  const activeIsRunning =
    currentStatus === "queued" || currentStatus === "running"
  const inputText = getInputText(run.input)
  const outputText = streamingText || getOutputText(run.output)
  const displaySteps = streamingSteps.length > 0 ? streamingSteps : steps

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {isRunning && (
          <Button
            size="xs"
            variant="destructive"
            onClick={() => cancelMutation.mutate(run.id)}
            disabled={cancelMutation.isPending}
            className="gap-1 text-xs"
          >
            {cancelMutation.isPending ? (
              <Spinner className="size-3" />
            ) : (
              <IconPlayerStop className="size-3" />
            )}
            Stop run
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3.5 py-3">
        <RunStatusBadge status={run.status} />
        <span className="text-xs text-muted-foreground">
          {formatDuration(run.startedAt ?? run.createdAt, run.completedAt)}
        </span>
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between py-1 text-muted-foreground">
          <span>Started</span>
          <span className="font-mono text-foreground">
            {formatTimestamp(run.startedAt ?? run.createdAt)}
          </span>
        </div>
        {run.completedAt && (
          <div className="flex justify-between py-1 text-muted-foreground">
            <span>Completed</span>
            <span className="font-mono text-foreground">
              {formatTimestamp(run.completedAt)}
            </span>
          </div>
        )}
        <div className="flex justify-between py-1 text-muted-foreground">
          <span>Trigger</span>
          <span className="font-mono text-foreground">{run.triggerType}</span>
        </div>
      </div>

      {inputText && (
        <div>
          <p className="mb-1 text-[11px] font-medium text-muted-foreground">
            Input prompt
          </p>
          <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs leading-relaxed text-foreground">
            {inputText}
          </div>
        </div>
      )}

      {steps.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-medium text-muted-foreground">
            Tool execution steps ({steps.length})
          </p>
          <div className="rounded-xl border border-border p-3">
            <ExecutionStepsCard steps={steps} isLive={isRunning} />
          </div>
        </div>
      )}

      {outputText && (
        <div>
          <p className="mb-1 text-[11px] font-medium text-muted-foreground">
            Final output
          </p>
          <div className="typeset typeset-chat rounded-xl border border-border bg-card p-3 text-xs leading-relaxed text-foreground">
            <Markdown>{outputText}</Markdown>
          </div>
        </div>
      )}

      {run.error && (
        <div>
          <p className="mb-1 text-[11px] font-medium text-destructive">Error</p>
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 font-mono text-xs text-destructive">
            {run.error}
          </div>
        </div>
      )}
    </div>
  )
}
