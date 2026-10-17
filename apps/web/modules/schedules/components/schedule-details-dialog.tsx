"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@openbots/ui/components/dialog"
import * as React from "react"
import { cn } from "@/lib/utils"
import { formatTimestamp } from "@/modules/runs/utils"
import type { ScheduleItem } from "../types"
import { KNOWN_CRONS } from "./schedule-row"

interface ScheduleDetailsDialogProps {
  schedule: ScheduleItem | null
  onOpenChange: (open: boolean) => void
}

export function ScheduleDetailsDialog({
  schedule,
  onOpenChange,
}: ScheduleDetailsDialogProps) {
  return (
    <Dialog open={Boolean(schedule)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[93%] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{schedule?.name || "Schedule Details"}</DialogTitle>
          <DialogDescription>
            Configuration and recurrence schedule
          </DialogDescription>
        </DialogHeader>

        {schedule && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-xs">
              <span className="text-muted-foreground">Status</span>
              <span
                className={cn(
                  "flex items-center gap-1.5 font-medium capitalize",
                  schedule.status === "active"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    schedule.status === "active"
                      ? "bg-emerald-500"
                      : "bg-muted-foreground/50"
                  )}
                />
                {schedule.status}
              </span>
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Frequency</span>
                <span className="font-medium text-foreground">
                  {KNOWN_CRONS[schedule.cronExpression.trim()] ??
                    schedule.cronExpression}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cron expression</span>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                  {schedule.cronExpression}
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Timezone</span>
                <span className="text-foreground">{schedule.timezone}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-mono text-foreground">
                  {formatTimestamp(schedule.createdAt)}
                </span>
              </div>
            </div>

            {schedule.prompt && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Prompt instruction
                </p>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-muted/40 p-3 text-xs leading-relaxed text-foreground">
                  {schedule.prompt}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
