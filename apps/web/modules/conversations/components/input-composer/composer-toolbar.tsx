"use client";

import { Button } from "@openbots/ui/components/button";
import { Spinner } from "@openbots/ui/components/spinner";
import type * as React from "react";
import { ArrowUp, Plus, Stop3 } from "reicon-react";

interface ComposerToolbarProps {
  onAttachClick: (e: React.MouseEvent) => void;
  isAttachDisabled: boolean;
  attachTitle: string;
  isActiveRun?: boolean;
  onCancelRun?: () => void;
  isCancelling?: boolean;
  canSubmit: boolean;
  isSubmitting?: boolean;
  isUploadingAny?: boolean;
}

export function ComposerToolbar({
  onAttachClick,
  isAttachDisabled,
  attachTitle,
  isActiveRun,
  onCancelRun,
  isCancelling,
  canSubmit,
  isSubmitting,
  isUploadingAny,
}: ComposerToolbarProps) {
  return (
    <>
      {/* Attach Button */}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onAttachClick}
        disabled={isAttachDisabled}
        className="absolute bottom-2.5 left-2 size-8 rounded-full text-muted-foreground transition-transform hover:bg-muted hover:text-foreground active:scale-95"
        title={attachTitle}
        aria-label="Attach files"
      >
        <Plus className="size-4" />
      </Button>

      {/* Action Submit / Stop Button */}
      {isActiveRun && onCancelRun ? (
        <Button
          type="button"
          size="icon"
          onClick={onCancelRun}
          disabled={isCancelling}
          className="absolute right-2 bottom-2.5 size-8 rounded-full transition-transform active:scale-95"
          aria-label="Stop run"
        >
          {isCancelling ? (
            <Spinner className="size-3.5" />
          ) : (
            <Stop3 className="size-3.5" />
          )}
        </Button>
      ) : (
        <Button
          type="submit"
          size="icon"
          disabled={!canSubmit}
          className="absolute right-2 bottom-2.5 size-8 rounded-full transition-[opacity,transform] active:scale-95 disabled:opacity-40"
          aria-label="Send message"
        >
          {isSubmitting || isUploadingAny ? (
            <Spinner className="size-3.5" />
          ) : (
            <ArrowUp className="size-3.5" />
          )}
        </Button>
      )}
    </>
  );
}
