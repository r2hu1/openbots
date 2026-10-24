"use client";

import { Button } from "@openbots/ui/components/button";
import { Input } from "@openbots/ui/components/input";
import { Spinner } from "@openbots/ui/components/spinner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import {
  Plus as IconPlus,
  Search as IconSearch,
  Trash2 as IconTrash,
} from "reicon-react";
import { useAgentsQuery } from "@/modules/agents/queries";
import { Panel, SectionHeader } from "./settings-shared";

interface MemoryItem {
  id: string;
  agentId: string;
  key: string;
  content: string;
  category: string;
  updatedAt: string;
}

export function MemoryTab() {
  const queryClient = useQueryClient();
  const { data: agents = [], isLoading: isLoadingAgents } = useAgentsQuery();
  const [selectedAgentId, setSelectedAgentId] = React.useState<string>("");

  React.useEffect(() => {
    if (agents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agents[0]?.id || "");
    }
  }, [agents, selectedAgentId]);

  const [search, setSearch] = React.useState("");
  const [newKey, setNewKey] = React.useState("");
  const [newContent, setNewContent] = React.useState("");
  const [newCategory, setNewCategory] = React.useState("general");
  const [isAdding, setIsAdding] = React.useState(false);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const getHeaders = React.useCallback(() => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (typeof window !== "undefined") {
      const token =
        localStorage.getItem("bearer_token") ||
        localStorage.getItem("better-auth_token");
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }, []);

  const { data: memories = [], isLoading: isLoadingMemories } = useQuery({
    queryKey: ["memories", selectedAgentId, search],
    enabled: Boolean(selectedAgentId),
    queryFn: async () => {
      const url = new URL(`${apiBaseUrl}/api/memories`);
      url.searchParams.set("agentId", selectedAgentId);
      if (search.trim()) url.searchParams.set("query", search.trim());
      const res = await fetch(url.toString(), {
        headers: getHeaders(),
        credentials: "include",
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.memories || []) as MemoryItem[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${apiBaseUrl}/api/memories`, {
        method: "POST",
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify({
          agentId: selectedAgentId,
          key: newKey.trim(),
          content: newContent.trim(),
          category: newCategory.trim() || "general",
        }),
      });
      if (!res.ok) throw new Error("Failed to save memory");
      return res.json();
    },
    onSuccess: () => {
      setNewKey("");
      setNewContent("");
      setNewCategory("general");
      setIsAdding(false);
      queryClient.invalidateQueries({
        queryKey: ["memories", selectedAgentId],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const url = new URL(`${apiBaseUrl}/api/memories/${id}`);
      url.searchParams.set("agentId", selectedAgentId);
      const res = await fetch(url.toString(), {
        method: "DELETE",
        headers: getHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete memory");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["memories", selectedAgentId],
      });
    },
  });

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Agent Memory"
        description="Persistent long-term memories and facts scoped per agent with high-speed Redis caching."
      />

      {/* Agent Selector */}
      {agents.length > 0 && (
        <div className="flex items-center gap-2">
          <label
            htmlFor="agent-select"
            className="text-xs font-medium text-muted-foreground shrink-0"
          >
            Select Agent:
          </label>
          <select
            id="agent-select"
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 py-1 text-sm font-medium text-foreground outline-none focus:ring-1 focus:ring-primary"
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${selectedAgent?.name || "agent"}'s memories...`}
            className="pl-9 text-sm"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant={isAdding ? "secondary" : "default"}
          onClick={() => setIsAdding(!isAdding)}
          className="gap-1.5"
          disabled={!selectedAgentId}
        >
          <IconPlus className="size-3.5" />
          {isAdding ? "Cancel" : "Add Memory"}
        </Button>
      </div>

      {isAdding && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            New Memory for {selectedAgent?.name || "Agent"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Key (e.g. user_preferred_framework)"
              className="text-sm"
            />
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Category (default: general)"
              className="text-sm"
            />
          </div>
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Content / Fact to remember..."
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              disabled={
                !newKey.trim() || !newContent.trim() || addMutation.isPending
              }
              onClick={() => addMutation.mutate()}
            >
              {addMutation.isPending ? (
                <Spinner className="size-3.5 mr-1" />
              ) : null}
              Save Memory
            </Button>
          </div>
        </div>
      )}

      {isLoadingAgents || isLoadingMemories ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-5" />
        </div>
      ) : memories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            No memories found for {selectedAgent?.name || "this agent"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {search
              ? "Try searching for a different keyword."
              : `${selectedAgent?.name || "This agent"} will save memories during conversations, or you can add one manually.`}
          </p>
        </div>
      ) : (
        <Panel>
          {memories.map((m) => (
            <div
              key={m.id}
              className="flex items-start justify-between gap-4 p-4 transition-colors hover:bg-muted/10"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {m.key}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {m.category}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {m.content}
                </p>
                <p className="text-[10px] text-muted-foreground/60">
                  Updated {new Date(m.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => deleteMutation.mutate(m.id)}
                disabled={deleteMutation.isPending}
                className="size-7 text-muted-foreground hover:text-destructive"
                title="Delete memory"
              >
                <IconTrash className="size-3.5" />
              </Button>
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}
