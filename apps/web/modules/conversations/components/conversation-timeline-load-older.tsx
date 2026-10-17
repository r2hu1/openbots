"use client"

import { Button } from "@openbots/ui/components/button"
import { Spinner } from "@openbots/ui/components/spinner"
import { IconChevronUp } from "@tabler/icons-react"
import * as React from "react"

interface ConversationTimelineLoadOlderProps {
  hasOlderMessages: boolean
  isLoadingOlder: boolean
  onLoadOlderMessages?: () => void
}

export function ConversationTimelineLoadOlder({
  hasOlderMessages,
  isLoadingOlder,
  onLoadOlderMessages,
}: ConversationTimelineLoadOlderProps) {
  if (!hasOlderMessages) return null

  return (
    <div className="flex min-h-8 justify-center py-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onLoadOlderMessages}
        disabled={isLoadingOlder}
        className="gap-2 text-xs"
      >
        {isLoadingOlder ? (
          <>
            <Spinner className="size-3.5" />
            <span className="shimmer">Loading older messages...</span>
          </>
        ) : (
          <>
            <IconChevronUp className="size-3.5" />
            <span>Load older messages</span>
          </>
        )}
      </Button>
    </div>
  )
}
