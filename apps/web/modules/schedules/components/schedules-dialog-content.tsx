"use client"

import { Input } from "@openbots/ui/components/input"
import { Spinner } from "@openbots/ui/components/spinner"
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@openbots/ui/components/input-group"

export function SchedulesDialogContent() {
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

  return (
    <div className="flex h-[70vh] flex-col overflow-hidden">
      <div className="px-3 py-1">
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search all schedules by name, instruction, or agent..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : groupedByAgent.length === 0 ? (
          <div className="p-8">
            <SchedulesEmptyState />
          </div>
        ) : (
          <div className="space-y-4 p-3">
            {groupedByAgent.map((group) => (
              <div
                key={group.agentId}
                className="overflow-hidden rounded-lg border border-input"
              >
                <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3.5 py-2 text-xs font-semibold text-foreground">
                  <span className="truncate">{group.agentName}</span>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {group.items.length}{" "}
                    {group.items.length === 1 ? "task" : "tasks"}
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {group.items.map((schedule) => (
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
              </div>
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
