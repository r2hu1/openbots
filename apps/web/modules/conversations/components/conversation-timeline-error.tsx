"use client"

import { Button } from "@openbots/ui/components/button"
import { IconAlertCircle, IconX } from "@tabler/icons-react"
import * as React from "react"

interface ConversationTimelineErrorProps {
  error: string
  onDismiss?: () => void
}

export function ConversationTimelineError({
  error,
  onDismiss,
}: ConversationTimelineErrorProps) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
      <div className="flex items-start gap-2.5">
        <IconAlertCircle className="size-4.5 shrink-0 translate-y-0.5 text-destructive" />
        <div className="flex-1 space-y-1">
          <p className="text-xs font-semibold">Unable to run agent</p>
          <p className="text-xs leading-relaxed opacity-90">{error}</p>
        </div>
        {onDismiss && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onDismiss}
            className="size-5 text-destructive hover:bg-destructive/20"
            title="Dismiss error"
          >
            <IconX className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
