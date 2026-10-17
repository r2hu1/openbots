"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@openbots/ui/components/dialog"
import * as React from "react"
import { RunDetailView } from "@/modules/runs/components/run-detail-view"
import type { RunRecord } from "@/modules/runs/types"
import type { QueuedInput } from "./schedule-history-rows"

interface ScheduleRunDialogProps {
  selectedRun: RunRecord | null
  agentId: string | null
  onOpenChange: (open: boolean) => void
}

export function ScheduleRunDialog({
  selectedRun,
  agentId,
  onOpenChange,
}: ScheduleRunDialogProps) {
  return (
    <Dialog open={Boolean(selectedRun)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[93%] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {((selectedRun?.input ?? {}) as QueuedInput).scheduledTaskName ||
              (selectedRun?.status === "queued"
                ? "Queued Task Details"
                : "Execution Run Details")}
          </DialogTitle>
          <DialogDescription>
            {selectedRun?.status === "queued"
              ? "Pending execution schedule & details"
              : "Execution traces, status, and outputs"}
          </DialogDescription>
        </DialogHeader>

        {selectedRun && (
          <RunDetailView
            runId={selectedRun.id}
            agentId={agentId}
            onBack={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
