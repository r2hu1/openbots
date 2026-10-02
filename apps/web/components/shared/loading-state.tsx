"use client";

import { Spinner } from "@openbots/ui/components/spinner";
import { cn } from "@openbots/ui/lib/utils";

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label, className }: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-2 p-6 text-muted-foreground",
        className,
      )}
    >
      <Spinner className="size-6 text-muted-foreground" />
      {label && <p className="text-xs">{label}</p>}
    </div>
  );
}
