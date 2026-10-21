"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@openbots/ui/components/alert-dialog"
import { Button } from "@openbots/ui/components/button"
import { Spinner } from "@openbots/ui/components/spinner"
import * as React from "react"
import { cn } from "@/lib/utils"
import type { ScheduleItem } from "../types"
import { Clock2, Pause, Play, Trash2 } from "reicon-react"

import { formatCronReadable, KNOWN_CRONS } from "./cron-format"
export { KNOWN_CRONS }

interface ScheduleRowProps {
  schedule: ScheduleItem
  toggling: boolean
  deleting: boolean
  onToggle: (schedule: ScheduleItem) => void
  onDelete: (id: string) => void
  onSelect: (schedule: ScheduleItem) => void
}

export function ScheduleRow({
  schedule,
  toggling,
  deleting,
  onToggle,
  onDelete,
  onSelect,
}: ScheduleRowProps) {
  const isPaused = schedule.status === "paused"
  const cron = schedule.cronExpression.trim()
  const readable = formatCronReadable(cron)

  return (
    <div
      onClick={() => onSelect(schedule)}
      className="flex cursor-pointer items-start gap-3 px-3.5 py-3.5 transition-colors hover:bg-muted/40"
    >
      <span
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          isPaused ? "bg-muted-foreground/40" : "bg-emerald-500"
        )}
        title={isPaused ? "Paused" : "Active"}
      />

      <div className={cn("min-w-0 flex-1", isPaused && "opacity-60")}>
        <p className="truncate text-sm font-medium text-foreground">
          {schedule.name}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
          {schedule.prompt}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <Clock2 className="size-3 shrink-0" />
          {readable ? (
            <span>{readable}</span>
          ) : (
            <code className="rounded bg-muted px-1 py-px font-mono">
              {cron}
            </code>
          )}
          <span aria-hidden>·</span>
          <span>{schedule.timezone}</span>
          {isPaused && (
            <>
              <span aria-hidden>·</span>
              <span>Paused</span>
            </>
          )}
        </div>
      </div>

      <div
        className="flex shrink-0 items-center gap-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon-xs"
          title={isPaused ? "Resume schedule" : "Pause schedule"}
          aria-label={isPaused ? "Resume schedule" : "Pause schedule"}
          onClick={() => onToggle(schedule)}
          disabled={toggling}
          className="text-muted-foreground hover:text-foreground"
        >
          {toggling ? (
            <Spinner className="size-3" />
          ) : isPaused ? (
            <Play />
          ) : (
            <Pause />
          )}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                title="Delete schedule"
                aria-label="Delete schedule"
                disabled={deleting}
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                {deleting ? <Spinner className="size-3" /> : <Trash2 />}
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this schedule?</AlertDialogTitle>
              <AlertDialogDescription>
                &ldquo;{schedule.name}&rdquo; will stop running. This cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting}
                onClick={() => onDelete(schedule.id)}
                className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
              >
                {deleting && <Spinner />} Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
