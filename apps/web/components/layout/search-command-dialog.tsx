"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@openbots/ui/components/command";
import { Blobatar } from "@openbots/ui/components/ui/blobatar";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import * as React from "react";
import {
  Check,
  Devices,
  Home,
  Logout,
  MessageSquare,
  Moon3,
  Plug2,
  Plus,
  Search2,
  Setting,
  Sun2,
  User,
} from "reicon-react";
import { useDebounce } from "@/hooks/use-debounce";
import { signOut } from "@/lib/auth-client";
import type { Agent } from "@/modules/agents/types";
import { useTimelineSearchQuery } from "@/modules/conversations/queries";

interface SearchCommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  onOpenCreateAgent?: () => void;
  onOpenSettings?: () => void;
  onOpenConnections?: () => void;
}

export function SearchCommandDialog({
  open,
  onOpenChange,
  agents,
  onOpenCreateAgent,
  onOpenSettings,
  onOpenConnections,
}: SearchCommandDialogProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [search, setSearch] = React.useState("");

  // Debounce search query to safeguard database from high query frequency
  const debouncedSearch = useDebounce(search.trim(), 280);

  // Remote full-text search across conversation messages
  const { data: timelineResults = [], isFetching: isSearchingTimeline } =
    useTimelineSearchQuery(debouncedSearch, open);

  const handleSelect = React.useCallback(
    (action: () => void) => {
      onOpenChange(false);
      setSearch("");
      action();
    },
    [onOpenChange],
  );

  const navigateToMessage = React.useCallback(
    (agentId: string, conversationId: string, messageId: string) => {
      handleSelect(() => {
        const targetUrl = `/agent/${agentId}?conversationId=${conversationId}#message-${messageId}`;
        router.push(targetUrl);

        if (typeof window !== "undefined") {
          window.location.hash = `message-${messageId}`;
          window.dispatchEvent(
            new CustomEvent("openbots:navigate-message", {
              detail: { agentId, conversationId, messageId },
            }),
          );
        }
      });
    },
    [handleSelect, router],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setSearch("");
      }}
      title="Search and Navigation"
      description="Quickly jump between agents, pages, commands, and chat history."
    >
      <CommandInput
        placeholder="Type a command, agent name, or search chat messages..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList className="max-h-84">
        <CommandEmpty>
          {isSearchingTimeline ? "Searching timeline..." : "No results found."}
        </CommandEmpty>

        {/* Timeline Message Search Results */}
        {timelineResults.length > 0 && (
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
                    navigateToMessage(
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
        )}

        {/* Agents Group */}
        <CommandGroup heading="Agents">
          {agents.map((agent) => (
            <CommandItem
              key={agent.id}
              value={`agent ${agent.name} ${agent.description || ""}`}
              onSelect={() =>
                handleSelect(() => {
                  router.push(`/agent/${agent.id}`);
                })
              }
              className="relative"
            >
              <Blobatar name={agent.name} className="size-4.5! shrink-0" />
              <span className="truncate font-medium">{agent.name}</span>
              {agent.description && (
                <span className="absolute right-2 truncate text-xs text-muted-foreground">
                  {agent.description}
                </span>
              )}
            </CommandItem>
          ))}
          {onOpenCreateAgent && (
            <CommandItem
              value="create new agent"
              onSelect={() => handleSelect(onOpenCreateAgent)}
            >
              <Plus className="size-4" />
              <span>Create New Agent</span>
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        {/* Pages & Navigation Group */}
        <CommandGroup heading="Navigation">
          <CommandItem
            value="go to home workspace dashboard"
            onSelect={() => handleSelect(() => router.push("/"))}
          >
            <Home className="size-4" />
            <span>Workspace Home</span>
            <CommandShortcut>G H</CommandShortcut>
          </CommandItem>
          {onOpenConnections && (
            <CommandItem
              value="open integrations connections apps tools"
              onSelect={() => handleSelect(onOpenConnections)}
            >
              <Plug2 className="size-4" />
              <span>Integrations & Connections</span>
              <CommandShortcut>G C</CommandShortcut>
            </CommandItem>
          )}
          {onOpenSettings && (
            <CommandItem
              value="open settings preferences api keys account"
              onSelect={() => handleSelect(onOpenSettings)}
            >
              <Setting className="size-4" />
              <span>Settings</span>
              <CommandShortcut>G S</CommandShortcut>
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        {/* Appearance & Quick Actions */}
        <CommandGroup heading="Preferences & Actions">
          <CommandItem
            value="theme switch toggle light mode"
            onSelect={() => handleSelect(() => setTheme("light"))}
            className="relative"
          >
            <Sun2 className="size-4" />
            <span>Light Theme</span>
            {theme === "light" && <Check className="absolute right-2 size-4" />}
          </CommandItem>
          <CommandItem
            value="theme switch toggle dark mode"
            className="relative"
            onSelect={() => handleSelect(() => setTheme("dark"))}
          >
            <Moon3 className="size-4" />
            <span>Dark Theme</span>
            {theme === "dark" && <Check className="absolute right-2 size-4" />}
          </CommandItem>
          <CommandItem
            value="theme system auto"
            className="relative w-full"
            onSelect={() => handleSelect(() => setTheme("system"))}
          >
            <Devices className="size-4" />
            <span>System Theme</span>
            {theme === "system" && (
              <Check className="absolute right-2 size-4" />
            )}
          </CommandItem>
          <CommandItem
            value="log out sign out exit account"
            onSelect={() =>
              handleSelect(async () => {
                await signOut();
                router.replace("/login");
              })
            }
          >
            <Logout className="size-4" />
            <span>Log out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
