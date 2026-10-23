"use client"

import { Blobatar } from "@openbots/ui/components/ui/blobatar"
import * as React from "react"

interface ConversationTimelineEmptyProps {
  agentName: string
}

export function ConversationTimelineEmpty({
  agentName,
}: ConversationTimelineEmptyProps) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <div className="flex items-center justify-center">
        <Blobatar
          name={agentName}
          alt={agentName}
          className="size-14!"
          blobatar={{ animate: "always" }}
        />
      </div>
      <h3 className="font-heading text-base font-medium text-foreground">
        Ready to chat with {agentName}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Send a task or query below. or just say Hii!
      </p>
    </div>
  )
}
