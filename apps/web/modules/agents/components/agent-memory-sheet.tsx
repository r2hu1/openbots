"use client"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@openbots/ui/components/sheet"
import * as React from "react"
import { Sparkle } from "reicon-react"
import { AgentMemoryContent } from "./agent-memory-content"

interface AgentMemorySheetProps {
  agentId: string | null
  agentName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AgentMemorySheet({
  agentId,
  agentName,
  open,
  onOpenChange,
}: AgentMemorySheetProps) {
  if (!agentId) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex min-h-0 w-full flex-col sm:max-w-lg"
      >
        <SheetHeader className="shrink-0 pb-2">
          <div className="flex items-center gap-2">
            <Sparkle className="size-4 text-primary" />
            <SheetTitle>{agentName || "Agent"} Memory</SheetTitle>
          </div>
          <SheetDescription>
            Inspect and manage persistent long-term memories saved specifically for this agent.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 pt-2">
          <AgentMemoryContent agentId={agentId} agentName={agentName} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
