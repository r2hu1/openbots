"use client";

import * as React from "react";
import { CommandGroup, CommandItem } from "@openbots/ui/components/command";
import { Blobatar } from "@openbots/ui/components/ui/blobatar";
import type { Agent } from "@/modules/agents/types";
import type { TimelineSearchResult } from "@/modules/conversations/queries";

interface SearchCommandTimelineGroupProps {
  timelineResults: TimelineSearchResult[];
  agents: Agent[];
  onSelectMessage: (agentId: string, conversationId: string, messageId: string) => void;
}

export function SearchCommandTimelineGroup({
  timelineResults,
  agents,
  onSelectMessage,
}: SearchCommandTimelineGroupProps) {
  if (timelineResults.length === 0) return null;

  return (
    <CommandGroup heading="Chat Timeline Messages">
      {timelineResults.map((item) => {
        const matchedAgent = agents.find((a) => a.id === item.agentId);
        const agentLabel = matchedAgent?.name || "Agent";
        const agentRole = matchedAgent?.description;
        return (
          <CommandItem
            key={`timeline-${item.messageId}`}
            value={`message ${item.text} ${agentLabel} ${item.conversationTitle || ""}`}
            onSelect={() =>
              onSelectMessage(
                item.agentId,
                item.conversationId,
                item.messageId,
              )
            }
            className="flex items-start gap-2.5 py-2"
          >
            <Blobatar name={agentLabel} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {agentLabel}
                </span>
                <span className="ml-auto text-[11px]">{agentRole}</span>
              </div>
              <p className="line-clamp-2 text-xs leading-relaxed text-foreground/90">
                {item.text}
              </p>
            </div>
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
}
