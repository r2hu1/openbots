"use client";

import { cn } from "@/lib/utils";
import { Kbd } from "@openbots/ui/components/kbd";
import type * as React from "react";
import type { SlashCommand } from "./types";

interface SlashCommandMenuProps {
  isOpen: boolean;
  commands: SlashCommand[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onSelectCommand: (command: SlashCommand) => void;
  commandListRef: React.RefObject<HTMLDivElement | null>;
}

export function SlashCommandMenu({
  isOpen,
  commands,
  selectedIndex,
  onSelectIndex,
  onSelectCommand,
  commandListRef,
}: SlashCommandMenuProps) {
  if (!isOpen || commands.length === 0) return null;

  return (
    <div
      ref={commandListRef}
      role="listbox"
      aria-label="Slash commands"
      className="dark absolute bottom-full left-0 z-50 mb-2 w-full max-w-md origin-bottom-left animate-in overflow-hidden rounded-lg border border-border/60 bg-popover duration-100 fade-in-0 outline-none slide-in-from-bottom-10 zoom-in-95"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between bg-popover px-3 py-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        Commands
        <Kbd>TAB</Kbd>
      </div>

      <div className="max-h-72 w-full space-y-0.5 overflow-y-auto px-1.5 pb-1.5">
        {commands.map((command, idx) => {
          const isSelected = idx === selectedIndex;
          const Icon = command.icon;

          return (
            <button
              key={command.name}
              type="button"
              data-index={idx}
              role="option"
              aria-selected={isSelected}
              onMouseEnter={() => onSelectIndex(idx)}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelectCommand(command);
              }}
              className={cn(
                "flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                isSelected
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg",
                    isSelected
                      ? "bg-background text-foreground"
                      : "bg-muted/50 text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground">
                      {command.label}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground/70">
                      {command.insertText}
                    </span>
                  </div>

                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {command.description}
                  </p>
                </div>
              </div>

              {command.category && (
                <span className="shrink-0 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                  {command.category}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
