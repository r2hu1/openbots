"use client";

import { Button } from "@openbots/ui/components/button";
import { ArrowToDownLeft, X } from "reicon-react";
import type { ReplyTarget } from "../../types";

interface ReplyingBannerProps {
  replyTarget: ReplyTarget | null;
  onClearReply?: () => void;
}

export function ReplyingBanner({
  replyTarget,
  onClearReply,
}: ReplyingBannerProps) {
  if (!replyTarget) return null;

  return (
    <div className="mx-3 mt-2.5 flex animate-in items-center justify-between rounded-lg bg-muted px-2.5 py-1.5 text-xs fade-in-0 slide-in-from-bottom-1">
      <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <ArrowToDownLeft className="size-3 shrink-0" />

        <span className="shrink-0 font-medium text-foreground">
          Replying to {replyTarget.sender}
        </span>

        <span className="truncate text-muted-foreground/80">
          "{replyTarget.text.replace(/\s+/g, " ").slice(0, 80)}"
        </span>
      </div>

      {onClearReply && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation();
            onClearReply();
          }}
          className="size-5 shrink-0 text-muted-foreground hover:text-foreground"
          title="Cancel reply"
          aria-label="Cancel reply"
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  );
}
