"use client"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@openbots/ui/components/sheet"
import { Spinner } from "@openbots/ui/components/spinner"
import * as React from "react"
import { cn } from "@/lib/utils"
import { useAgentStream } from "@/modules/agents/hooks/use-agent-stream"
import { useRunsQuery } from "@/modules/runs/queries"
import type { RunRecord } from "@/modules/runs/types"
import {
  useDeleteScheduleMutation,
  useSchedulesQuery,
  useUpdateScheduleMutation,
} from "../queries"
import type { ScheduleItem } from "../types"
import { Calendar2Newicons } from "reicon-react"
import { ScheduleRow } from "./schedule-row"
import {
  GroupLabel,
  HistoryRow,
  type QueuedInput,
  QueuedRow,
} from "./schedule-history-rows"
import { ScheduleDetailsDialog } from "./schedule-details-dialog"
import { ScheduleRunDialog } from "./schedule-run-dialog"
import { SchedulesEmptyState } from "./schedules-empty-state"

interface SchedulesSheetProps {
  agentId: string | null
  agentName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SCROLL_CLASS =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain " +
  "[scrollbar-gutter:stable] [scrollbar-width:thin] " +
  "[scrollbar-color:color-mix(in_oklab,currentColor_25%,transparent)_transparent]"

export function SchedulesSheet({
  agentId,
  agentName,
  open,
  onOpenChange,
}: SchedulesSheetProps) {
  useAgentStream({
    agentId,
    enabled: open,
  })

  const { data: schedules = [], isLoading: isLoadingSchedules } =
    useSchedulesQuery(agentId, {
      enabled: open,
      refetchInterval: false,
    })

  const { data: allRuns = [], isLoading: isLoadingRuns } = useRunsQuery(
    agentId,
    {
      enabled: open,
      refetchInterval: false,
    }
  )

  const queuedReminders = React.useMemo(
    () =>
      allRuns.filter(
        (r) => r.triggerType === "schedule" && r.status === "queued"
      ),
    [allRuns]
  )

  const pastExecutions = React.useMemo(
    () =>
      allRuns
        .filter(
          (r) =>
            r.triggerType === "schedule" &&
            (r.status === "completed" ||
              r.status === "failed" ||
              r.status === "cancelled")
        )
        .slice(0, 10),
    [allRuns]
  )

  const updateScheduleMutation = useUpdateScheduleMutation(agentId)
  const deleteScheduleMutation = useDeleteScheduleMutation(agentId)

  const handleToggleStatus = React.useCallback(
    (schedule: ScheduleItem) => {
      updateScheduleMutation.mutate({
        id: schedule.id,
        data: { status: schedule.status === "active" ? "paused" : "active" },
      })
    },
    [updateScheduleMutation]
  )

  const handleDelete = React.useCallback(
    (id: string) => deleteScheduleMutation.mutate(id),
    [deleteScheduleMutation]
  )

  const [selectedSchedule, setSelectedSchedule] =
    React.useState<ScheduleItem | null>(null)
  const [selectedRun, setSelectedRun] = React.useState<RunRecord | null>(null)

  const isLoading = isLoadingSchedules || isLoadingRuns
  const hasItems =
    schedules.length > 0 ||
    queuedReminders.length > 0 ||
    pastExecutions.length > 0

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full! flex-col sm:max-w-sm!"
        >
          <SheetHeader>
            <SheetTitle>Schedules</SheetTitle>
            <SheetDescription>
              Recurring jobs, queued reminders, and past runs for{" "}
              <span className="font-medium text-foreground">
                {agentName || "this agent"}
              </span>
              .
            </SheetDescription>
          </SheetHeader>

          <div className={cn("space-y-6 px-4 pb-6", SCROLL_CLASS)}>
            {isLoading ? (
              <div className="flex h-48 items-center justify-center">
                <Spinner className="size-5" />
              </div>
            ) : !hasItems ? (
              <SchedulesEmptyState />
            ) : (
              <>
                {schedules.length > 0 && (
                  <section>
                    <GroupLabel count={schedules.length}>Recurring</GroupLabel>
                    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                      {schedules.map((schedule) => (
                        <ScheduleRow
                          key={schedule.id}
                          schedule={schedule}
                          toggling={
                            updateScheduleMutation.isPending &&
                            updateScheduleMutation.variables?.id === schedule.id
                          }
                          deleting={
                            deleteScheduleMutation.isPending &&
                            deleteScheduleMutation.variables === schedule.id
                          }
                          onToggle={handleToggleStatus}
                          onDelete={handleDelete}
                          onSelect={setSelectedSchedule}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {queuedReminders.length > 0 && (
                  <section>
                    <GroupLabel count={queuedReminders.length}>
                      Queued
                    </GroupLabel>
                    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                      {queuedReminders.map((run) => {
                        const input = (run.input ?? {}) as QueuedInput
                        return (
                          <QueuedRow
                            key={run.id}
                            name={
                              input.scheduledTaskName || "Scheduled reminder"
                            }
                            prompt={input.prompt || ""}
                            scheduledFor={input.scheduledFor}
                            onClick={() => setSelectedRun(run)}
                          />
                        )
                      })}
                    </div>
                  </section>
                )}

                {pastExecutions.length > 0 && (
                  <section>
                    <GroupLabel count={pastExecutions.length}>
                      History
                    </GroupLabel>
                    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                      {pastExecutions.map((run) => {
                        const input = (run.input ?? {}) as QueuedInput
                        return (
                          <HistoryRow
                            key={run.id}
                            name={
                              input.scheduledTaskName || "Scheduled execution"
                            }
                            prompt={input.prompt || ""}
                            status={
                              run.status as "completed" | "failed" | "cancelled"
                            }
                            completedAt={run.completedAt}
                            error={run.error}
                            onClick={() => setSelectedRun(run)}
                          />
                        )
                      })}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ScheduleDetailsDialog
        schedule={selectedSchedule}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedSchedule(null)
        }}
      />

      <ScheduleRunDialog
        selectedRun={selectedRun}
        agentId={agentId}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedRun(null)
        }}
      />
    </>
  )
}
