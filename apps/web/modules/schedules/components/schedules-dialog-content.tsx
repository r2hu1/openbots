"use client"

import { Spinner } from "@openbots/ui/components/spinner"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@openbots/ui/components/input-group"
import * as React from "react"
import { Search } from "reicon-react"
import { useAgentsQuery } from "@/modules/agents/queries"
import {
  useDeleteScheduleMutation,
  useSchedulesQuery,
  useUpdateScheduleMutation,
} from "../queries"
import type { ScheduleItem } from "../types"
import { ScheduleDetailsDialog } from "./schedule-details-dialog"
import { ScheduleRow } from "./schedule-row"
import { SchedulesEmptyState } from "./schedules-empty-state"
import { Blobatar } from "@openbots/ui/components/ui/blobatar"

export function SchedulesDialogContent({
  onOpenChange,
  onSelectSchedule,
}: {
  onOpenChange?: (open: boolean) => void
  onSelectSchedule?: (schedule: ScheduleItem) => void
}) {
  const { data: schedules = [], isLoading } = useSchedulesQuery()
  const { data: agents = [] } = useAgentsQuery()
  const [selectedSchedule, setSelectedSchedule] =
    React.useState<ScheduleItem | null>(null)
  const [search, setSearch] = React.useState("")

  const toggleMutation = useUpdateScheduleMutation()
  const deleteMutation = useDeleteScheduleMutation()

  const handleToggle = (schedule: ScheduleItem) => {
    toggleMutation.mutate({
      id: schedule.id,
      data: { status: schedule.status === "active" ? "paused" : "active" },
    })
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id)
  }

  const agentMap = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const a of agents) {
      map.set(a.id, a.name)
    }
    return map
  }, [agents])

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return schedules
    return schedules.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.prompt.toLowerCase().includes(q) ||
        s.cronExpression.toLowerCase().includes(q) ||
        (agentMap.get(s.agentId) || "").toLowerCase().includes(q)
    )
  }, [schedules, search, agentMap])

  // Group schedules by agentId
  const groupedByAgent = React.useMemo(() => {
    const groups: Array<{
      agentId: string
      agentName: string
      items: ScheduleItem[]
    }> = []
    const map = new Map<string, ScheduleItem[]>()

    for (const item of filtered) {
      const list = map.get(item.agentId) || []
      list.push(item)
      map.set(item.agentId, list)
    }

    for (const [agentId, items] of map.entries()) {
      const agentName = agentMap.get(agentId) || "Unnamed Agent"
      groups.push({ agentId, agentName, items })
    }

    return groups.sort((a, b) => a.agentName.localeCompare(b.agentName))
  }, [filtered, agentMap])

  const hasQuery = search.trim().length > 0
  const activeCount = filtered.filter((s) => s.status === "active").length

  return (
    <div className="flex h-[70vh] flex-col overflow-hidden">
      <div className="space-y-2 border-b border-border px-4 pt-1 pb-3">
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search by name, instruction, or agent"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>

        {!isLoading && schedules.length > 0 && (
          <p className="px-1 text-xs text-muted-foreground tabular-nums">
            {filtered.length} {filtered.length === 1 ? "schedule" : "schedules"}
            {" · "}
            {activeCount} active
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : schedules.length === 0 ? (
          <div className="p-8">
            <SchedulesEmptyState />
          </div>
        ) : groupedByAgent.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-1 px-8 text-center">
            <p className="text-base font-medium text-foreground">
              No matches for “{search.trim()}”
            </p>
            <p className="text-sm text-muted-foreground">
              Try a different name, agent, or part of the instruction.
            </p>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="mt-3 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="space-y-5 p-4">
            {groupedByAgent.map((group) => (
              <section key={group.agentId} aria-label={group.agentName}>
                <header className="mb-2 flex items-center gap-2.5 px-1">
                  <Blobatar name={group.agentName} />
                  <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                    {group.agentName}
                  </h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
                    {group.items.length}
                  </span>
                </header>

                <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  {group.items.map((schedule) => (
                    <ScheduleRow
                      key={schedule.id}
                      schedule={schedule}
                      toggling={toggleMutation.isPending}
                      deleting={deleteMutation.isPending}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      onSelect={onSelectSchedule ?? setSelectedSchedule}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {!onSelectSchedule && (
        <ScheduleDetailsDialog
          schedule={selectedSchedule}
          onOpenChange={(open) => {
            if (!open) {
              onOpenChange?.(true)
            }
            setSelectedSchedule(null)
          }}
        />
      )}
    </div>
  )
}
