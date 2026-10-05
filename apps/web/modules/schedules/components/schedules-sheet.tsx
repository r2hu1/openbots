"use client";

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
} from "@openbots/ui/components/alert-dialog";
import { Button } from "@openbots/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@openbots/ui/components/sheet";
import { Spinner } from "@openbots/ui/components/spinner";
import * as React from "react";
import { cn } from "@/lib/utils";
import { useRunsQuery } from "@/modules/runs/queries";
import {
  useDeleteScheduleMutation,
  useSchedulesQuery,
  useUpdateScheduleMutation,
} from "../queries";
import type { ScheduleItem } from "../types";
import { Calendar2Newicons, Clock2, Pause, Play, Trash2 } from "reicon-react";

interface SchedulesSheetProps {
  agentId: string | null;
  agentName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface QueuedInput {
  scheduledTaskName?: string;
  prompt?: string;
  scheduledFor?: string;
}

const SCROLL_CLASS =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain " +
  "[scrollbar-gutter:stable] [scrollbar-width:thin] " +
  "[scrollbar-color:color-mix(in_oklab,currentColor_25%,transparent)_transparent]";

const KNOWN_CRONS: Record<string, string> = {
  "0 9 * * *": "Every day at 9:00 AM",
  "0 0 * * *": "Every day at midnight",
  "0 12 * * *": "Every day at noon",
  "*/15 * * * *": "Every 15 minutes",
  "*/30 * * * *": "Every 30 minutes",
  "0 * * * *": "Every hour",
  "0 9 * * 1": "Every Monday at 9:00 AM",
  "0 9 * * 1-5": "Every weekday at 9:00 AM",
};

function formatWhen(value?: string) {
  if (!value) return "Pending execution";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pending execution";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function GroupLabel({
  children,
  count,
}: {
  children: React.ReactNode;
  count: number;
}) {
  return (
    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {children}
      <span className="rounded-full bg-muted px-1.5 py-px text-[10px] text-foreground">
        {count}
      </span>
    </h3>
  );
}

function ScheduleRow({
  schedule,
  toggling,
  deleting,
  onToggle,
  onDelete,
}: {
  schedule: ScheduleItem;
  toggling: boolean;
  deleting: boolean;
  onToggle: (schedule: ScheduleItem) => void;
  onDelete: (id: string) => void;
}) {
  const isPaused = schedule.status === "paused";
  const cron = schedule.cronExpression.trim();
  const readable = KNOWN_CRONS[cron];

  return (
    <div className="flex items-start gap-3 px-3.5 py-3.5">
      <span
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          isPaused ? "bg-muted-foreground/40" : "bg-emerald-500",
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

      <div className="flex shrink-0 items-center gap-0.5">
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
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(schedule.id)}
                className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function QueuedRow({
  name,
  prompt,
  scheduledFor,
}: {
  name: string;
  prompt: string;
  scheduledFor?: string;
}) {
  return (
    <div className="flex items-start gap-3 px-3.5 py-3.5">
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
  );
}

export function SchedulesSheet({
  agentId,
  agentName,
  open,
  onOpenChange,
}: SchedulesSheetProps) {
  const { data: schedules = [], isLoading: isLoadingSchedules } =
    useSchedulesQuery(agentId, {
      enabled: open,
      refetchInterval: false,
    });

  const { data: allRuns = [], isLoading: isLoadingRuns } = useRunsQuery(
    agentId,
    {
      enabled: open,
      refetchInterval: false,
    },
  );

  const queuedReminders = React.useMemo(
    () =>
      allRuns.filter(
        (r) => r.triggerType === "schedule" && r.status === "queued",
      ),
    [allRuns],
  );

  const updateScheduleMutation = useUpdateScheduleMutation(agentId);
  const deleteScheduleMutation = useDeleteScheduleMutation(agentId);

  const handleToggleStatus = React.useCallback(
    (schedule: ScheduleItem) => {
      updateScheduleMutation.mutate({
        id: schedule.id,
        data: { status: schedule.status === "active" ? "paused" : "active" },
      });
    },
    [updateScheduleMutation],
  );

  const handleDelete = React.useCallback(
    (id: string) => deleteScheduleMutation.mutate(id),
    [deleteScheduleMutation],
  );

  const isLoading = isLoadingSchedules || isLoadingRuns;
  const hasItems = schedules.length > 0 || queuedReminders.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full! flex-col sm:max-w-sm!">
        <SheetHeader>
          <SheetTitle>Schedules</SheetTitle>
          <SheetDescription>
            Recurring jobs and queued reminders for{" "}
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
            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <Calendar2Newicons className="mx-auto mb-3 size-7 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">
                Nothing scheduled
              </p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                Ask your agent in chat, like &ldquo;Remind me to review notes in
                10 minutes&rdquo; or &ldquo;Send a daily report every day at
                9am&rdquo;.
              </p>
            </div>
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
                      />
                    ))}
                  </div>
                </section>
              )}

              {queuedReminders.length > 0 && (
                <section>
                  <GroupLabel count={queuedReminders.length}>Queued</GroupLabel>
                  <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                    {queuedReminders.map((run) => {
                      const input = (run.input ?? {}) as QueuedInput;
                      return (
                        <QueuedRow
                          key={run.id}
                          name={input.scheduledTaskName || "Scheduled reminder"}
                          prompt={input.prompt || ""}
                          scheduledFor={input.scheduledFor}
                        />
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
