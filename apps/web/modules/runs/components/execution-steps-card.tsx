"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openbots/ui/components/collapsible";
import {
  Marker,
  MarkerContent,
  MarkerIcon,
} from "@openbots/ui/components/marker";
import { Spinner } from "@openbots/ui/components/spinner";
import { IconCheck, IconChevronDown, IconX } from "@tabler/icons-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  type ActivityGroup,
  normalizeActivities,
  sanitizeDisplayData,
} from "../activity-stream";
import { formatToolStepLabel } from "../tool-label";
import type { StepItem } from "../types";

interface ExecutionStepsCardProps {
  steps: StepItem[];
  isLive?: boolean;
}

export function ExecutionStepsCard({ steps }: ExecutionStepsCardProps) {
  const activities = React.useMemo(() => normalizeActivities(steps), [steps]);

  if (activities.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5 py-1">
      {activities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </div>
  );
}

function ActivityItem({ activity }: { activity: ActivityGroup }) {
  const isRunning = activity.status === "running";
  const isFailed = activity.status === "failed";

  return (
    <Collapsible className="group/activity w-full">
      <Marker
        className={cn(
          "text-xs transition-colors hover:text-foreground",
          isRunning && !isFailed && "shimmer",
        )}
      >
        <MarkerIcon className="size-4 shrink-0">
          {isRunning && <Spinner className="size-3.5 text-primary" />}
          {!isRunning && !isFailed && <IconCheck className="size-3.5" />}
          {isFailed && <IconX className="size-3.5 text-destructive" />}
        </MarkerIcon>

        <MarkerContent className="flex flex-1 items-center justify-between gap-2 overflow-hidden py-0.5">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-medium text-foreground">
              {activity.title}
            </span>
            {activity.summary && (
              <span className="truncate text-[11px] text-muted-foreground">
                {activity.summary}
              </span>
            )}
          </div>

          <CollapsibleTrigger
            className="flex shrink-0 cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors select-none hover:bg-muted hover:text-foreground"
            aria-label="Toggle technical details"
          >
            <span>Details</span>
            <IconChevronDown className="size-3 transition-transform duration-200 group-data-[panel-open]/activity:rotate-180" />
          </CollapsibleTrigger>
        </MarkerContent>
      </Marker>

      <CollapsibleContent className="mt-1.5 ml-6 space-y-2 rounded-lg border border-border/40 bg-muted/30 p-2.5 font-mono text-[11px]">
        {activity.steps.map((step, idx) => {
          const stepKey = step.id || `substep-${step.stepNumber}-${idx}`;
          const { label } = formatToolStepLabel(
            step.toolName,
            step.status,
            step.toolInput,
            step.toolOutput,
          );
          const hasInput =
            step.toolInput !== undefined && step.toolInput !== null;
          const hasOutput =
            step.toolOutput !== undefined && step.toolOutput !== null;

          return (
            <div
              key={stepKey}
              className="space-y-1.5 border-b border-border/30 pb-2 last:border-b-0 last:pb-0"
            >
              <div className="flex items-center gap-2 font-sans text-foreground">
                <span className="text-xs font-medium">{label}</span>
                {step.toolName && (
                  <span className="font-mono text-[10px] text-muted-foreground/75">
                    ({step.toolName})
                  </span>
                )}
              </div>

              {hasInput && (
                <div>
                  <div className="font-sans text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                    Input
                  </div>
                  <pre className="max-h-36 overflow-x-auto rounded bg-background/80 p-2 whitespace-pre-wrap text-foreground/90">
                    {sanitizeDisplayData(step.toolInput)}
                  </pre>
                </div>
              )}

              {hasOutput && (
                <div>
                  <div className="font-sans text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                    Output
                  </div>
                  <pre className="max-h-36 overflow-x-auto rounded bg-background/80 p-2 whitespace-pre-wrap text-foreground/90">
                    {sanitizeDisplayData(step.toolOutput)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
