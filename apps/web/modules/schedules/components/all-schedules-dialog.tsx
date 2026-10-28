"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@openbots/ui/components/dialog"
import * as React from "react"
import type { ScheduleItem } from "../types"
import { useSchedulesStream } from "../hooks/use-schedules-stream"
import { ScheduleDetailsDialog } from "./schedule-details-dialog"
import { SchedulesDialogContent } from "./schedules-dialog-content"

interface AllSchedulesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AllSchedulesDialog({
  open,
  onOpenChange,
}: AllSchedulesDialogProps) {
  const [selectedSchedule, setSelectedSchedule] =
    React.useState<ScheduleItem | null>(null)

  useSchedulesStream({ enabled: open || Boolean(selectedSchedule) })

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="p-0! sm:max-w-2xl">
          <DialogHeader className="px-4 py-3 pb-0">
            <DialogTitle>Schedules</DialogTitle>
            <DialogDescription>
              All recurring tasks and scheduled events across your workspace
            </DialogDescription>
          </DialogHeader>

          <SchedulesDialogContent
            onOpenChange={onOpenChange}
            onSelectSchedule={(schedule) => {
              setSelectedSchedule(schedule)
              onOpenChange(false)
            }}
          />
        </DialogContent>
      </Dialog>

      <ScheduleDetailsDialog
        schedule={selectedSchedule}
        onOpenChange={(open) => {
          if (!open) {
            onOpenChange(true)
          }
          setSelectedSchedule(null)
        }}
      />
    </>
  )
}
