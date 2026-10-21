"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@openbots/ui/components/dialog"
import * as React from "react"
import { useSchedulesStream } from "../hooks/use-schedules-stream"
import { SchedulesDialogContent } from "./schedules-dialog-content"

interface AllSchedulesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AllSchedulesDialog({
  open,
  onOpenChange,
}: AllSchedulesDialogProps) {
  useSchedulesStream({ enabled: open })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95%] p-0! sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle>Schedules</DialogTitle>
          <DialogDescription>
            All recurring tasks and scheduled events across your workspace
          </DialogDescription>
        </DialogHeader>

        <SchedulesDialogContent />
      </DialogContent>
    </Dialog>
  )
}
