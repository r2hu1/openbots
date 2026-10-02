"use client";

import { Button } from "@openbots/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@openbots/ui/components/empty";
import { Blobatar } from "@openbots/ui/components/ui/blobatar";
import { cn } from "@openbots/ui/lib/utils";
import type * as React from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  blobatarName?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  onAction?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  blobatarName,
  icon,
  actionLabel,
  actionIcon,
  onAction,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-1 items-center justify-center p-6 text-center",
        className,
      )}
    >
      <Empty className="max-w-md rounded-xl border bg-card p-8 shadow-xs">
        <EmptyHeader>
          {(blobatarName || icon) && (
            <EmptyMedia variant="default">
              {blobatarName ? (
                <Blobatar
                  className="size-14!"
                  name={blobatarName}
                  blobatar={{ animate: "always" }}
                />
              ) : (
                icon
              )}
            </EmptyMedia>
          )}
          <EmptyTitle>{title}</EmptyTitle>
          {description && <EmptyDescription>{description}</EmptyDescription>}
        </EmptyHeader>

        {(actionLabel || children) && (
          <EmptyContent>
            {actionLabel && onAction && (
              <Button onClick={onAction} className="gap-1.5">
                {actionIcon}
                {actionLabel}
              </Button>
            )}
            {children}
          </EmptyContent>
        )}
      </Empty>
    </div>
  );
}
