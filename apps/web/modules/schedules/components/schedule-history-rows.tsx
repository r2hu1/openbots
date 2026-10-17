"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Clock2 } from "reicon-react"

export interface QueuedInput {
  scheduledTaskName?: string
  prompt?: string
  scheduledFor?: string
}

export function formatWhen(value?: string) {
  if (!value) return "Pending execution"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Pending execution"
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function GroupLabel({
  children,
  count,
}: {
  children: React.ReactNode
  count: number
}) {
  return (
    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {children}
      <span className="rounded-full bg-muted px-1.5 py-px text-[10px] text-foreground">
        {count}
      </span>
    </h3>
  )
}

interface HistoryRowProps {
  name: string
  prompt: string
  status: "completed" | "failed" | "cancelled"
  completedAt?: string | Date | null
  error?: string | null
  onClick: () => void
}

export function HistoryRow({
  name,
  prompt,
  status,
  completedAt,
  error,
  onClick,
}: HistoryRowProps) {
  const isFailed = status === "failed"
  const isCancelled = status === "cancelled"

  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-start gap-3 px-3.5 py-3 transition-colors hover:bg-muted/40"
    >
      <span
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          isFailed
            ? "bg-destructive"
            : isCancelled
              ? "bg-muted-foreground/40"
              : "bg-emerald-500"
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <span
            className={cn(
              "rounded-full px-1.5 py-px text-[10px] font-medium capitalize",
              isFailed
                ? "bg-destructive/10 text-destructive"
                : isCancelled
                  ? "bg-muted text-muted-foreground"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            )}
          >
            {status}
          </span>
        </div>
        {prompt && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
            {prompt}
          </p>
        )}
        {error && isFailed && (
          <p className="mt-1 line-clamp-1 text-[11px] text-destructive">
            {error}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock2 className="size-3 shrink-0" />
          <span>
            {completedAt
              ? `Finished ${formatWhen(String(completedAt))}`
              : "Completed"}
          </span>
        </div>
      </div>
    </div>
  )
}

interface QueuedRowProps {
  name: string
  prompt: string
  scheduledFor?: string
  onClick: () => void
}

export function QueuedRow({
  name,
  prompt,
  scheduledFor,
  onClick,
}: QueuedRowProps) {
  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-start gap-3 px-3.5 py-3.5 transition-colors hover:bg-muted/40"
    >
      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        {prompt && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
            {prompt}
          </p>
        )}
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock2 className="size-3 shrink-0" />
          <span>Runs {formatWhen(scheduledFor)}</span>
        </div>
      </div>
    </div>
  )
}
