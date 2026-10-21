"use client"

import { Input } from "@openbots/ui/components/input"
import { Spinner } from "@openbots/ui/components/spinner"
import * as React from "react"
import { Calendar, Search } from "reicon-react"
import {
  useDeleteScheduleMutation,
  useSchedulesQuery,
  useUpdateScheduleMutation,
} from "../queries"
import type { ScheduleItem } from "../types"
import { ScheduleDetailsDialog } from "./schedule-details-dialog"
import { ScheduleRow } from "./schedule-row"
import { SchedulesEmptyState } from "./schedules-empty-state"

export function SchedulesDialogContent() {
  const { data: schedules = [], isLoading } = useSchedulesQuery(null)
  const [selectedSchedule, setSelectedSchedule] = React.useState<ScheduleItem | null>(null)
  const [search, setSearch] = React.useState("")

  const toggleMutation = useUpdateScheduleMutation()
  const deleteMutation = useDeleteScheduleMutation()

  const handleToggle = (schedule: ScheduleItem) => {
    toggleMutation.mutate({
      id: schedule.id,
      input: { status: schedule.status === "active" ? "paused" : "active" },
    })
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id)
  }

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return schedules
    return schedules.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.prompt.toLowerCase().includes(q) ||
        s.cronExpression.toLowerCase().includes(q)
    )
  }, [schedules, search])

  return (
    <div className="flex h-[70vh] flex-col overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search all schedules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <SchedulesEmptyState
              hasActiveSchedule={false}
              hasFilter={Boolean(search.trim())}
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((schedule) => (
              <ScheduleRow
                key={schedule.id}
                schedule={schedule}
                toggling={toggleMutation.isPending}
                deleting={deleteMutation.isPending}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onSelect={setSelectedSchedule}
              />
            ))}
          </div>
        )}
      </div>

      <ScheduleDetailsDialog
        schedule={selectedSchedule}
        onOpenChange={(open) => {
          if (!open) setSelectedSchedule(null)
        }}
      />
    </div>
  )
}
