"use client";

import { Spinner } from "@openbots/ui/components/spinner";
import type { RunStatus } from "../types";

const STATUS_META: Record<
  RunStatus,
  { label: string; dot: string; text: string }
> = {
  completed: {
    label: "Completed",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  running: { label: "Running", dot: "", text: "text-foreground" },
  queued: {
    label: "Queued",
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
  },
  waiting: {
    label: "Waiting",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
  },
  failed: {
    label: "Failed",
    dot: "bg-destructive",
    text: "text-destructive",
  },
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.text}`}
    >
      {status === "running" ? (
        <Spinner className="size-3" />
      ) : (
        <span className={`size-1.5 rounded-full ${meta.dot}`} />
      )}
      {meta.label}
    </span>
  );
}
