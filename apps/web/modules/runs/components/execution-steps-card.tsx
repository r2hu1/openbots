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
import type { StepItem } from "../types";
import { sanitizeDisplayData } from "../utils";

interface ExecutionStepsCardProps {
  steps: StepItem[];
  isLive?: boolean;
}

export function ExecutionStepsCard({ steps }: ExecutionStepsCardProps) {
  const toolSteps = steps.filter((s) => s.type === "tool" || s.toolName);

  if (toolSteps.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 py-1">
      {toolSteps.map((step) => {
        const stepKey = step.id || `step-${step.stepNumber}`;
        const hasDetails =
          step.toolInput !== undefined || step.toolOutput !== undefined;

        if (!hasDetails) {
          return (
            <Marker key={stepKey} className="text-xs">
              <MarkerIcon>
                {step.status === "running" && (
                  <Spinner className="size-3.5 text-primary" />
                )}
                {step.status === "completed" && (
                  <IconCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
                {step.status === "failed" && (
                  <IconX className="size-3.5 text-destructive" />
                )}
              </MarkerIcon>
              <MarkerContent className="flex items-center gap-2">
                <span className="font-mono font-medium text-foreground">
                  {step.toolName || "tool_call"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {step.status === "running"
                    ? "calling..."
                    : step.status === "completed"
                      ? "called"
                      : "failed"}
                </span>
              </MarkerContent>
            </Marker>
          );
        }

        return (
          <Collapsible key={stepKey} className="group/step">
            <Marker className="text-xs">
              <MarkerIcon>
                {step.status === "running" && (
                  <Spinner className="size-3.5 text-primary" />
                )}
                {step.status === "completed" && (
                  <IconCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
                {step.status === "failed" && (
                  <IconX className="size-3.5 text-destructive" />
                )}
              </MarkerIcon>
              <MarkerContent className="flex flex-1 items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-foreground">
                    {step.toolName || "tool_call"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {step.status === "running"
                      ? "calling..."
                      : step.status === "completed"
                        ? "called"
                        : "failed"}
                  </span>
                </div>
                <CollapsibleTrigger className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <span>details</span>
                  <IconChevronDown className="size-3 transition-transform duration-200 group-data-[panel-open]/step:rotate-180" />
                </CollapsibleTrigger>
              </MarkerContent>
            </Marker>

            <CollapsibleContent className="mt-1.5 ml-6 space-y-2 rounded-md border border-border/50 bg-muted/40 p-2.5 font-mono text-[11px]">
              {step.toolInput !== undefined && (
                <div>
                  <div className="mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Input Parameters
                  </div>
                  <pre className="max-h-40 overflow-x-auto rounded bg-background/80 p-2 text-foreground/90 whitespace-pre-wrap">
                    {sanitizeDisplayData(step.toolInput)}
                  </pre>
                </div>
              )}
              {step.toolOutput !== undefined && (
                <div>
                  <div className="mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Output Result
                  </div>
                  <pre className="max-h-48 overflow-x-auto rounded bg-background/80 p-2 text-foreground/90 whitespace-pre-wrap">
                    {sanitizeDisplayData(step.toolOutput)}
                  </pre>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
