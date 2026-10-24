"use client"

import { Button } from "@openbots/ui/components/button"
import { Input } from "@openbots/ui/components/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@openbots/ui/components/input-group"
import { Spinner } from "@openbots/ui/components/spinner"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import {
  Plus as IconPlus,
  Search as IconSearch,
  Trash2 as IconTrash,
  X,
} from "reicon-react"

export interface MemoryItem {
  id: string
  agentId: string
  key: string
  content: string
  category: string
  updatedAt: string
}

interface AgentMemoryContentProps {
  agentId: string
  agentName?: string
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (typeof window !== "undefined") {
    const token =
      localStorage.getItem("bearer_token") ||
      localStorage.getItem("better-auth_token")
    if (token) headers.Authorization = `Bearer ${token}`
  }
  return headers
}

export function AgentMemoryContent({
  agentId,
  agentName,
}: AgentMemoryContentProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState("")
  const [newKey, setNewKey] = React.useState("")
  const [newContent, setNewContent] = React.useState("")
  const [newCategory, setNewCategory] = React.useState("general")
  const [isAdding, setIsAdding] = React.useState(false)

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

  const { data: memories = [], isLoading } = useQuery({
    queryKey: ["memories", agentId, search],
    enabled: Boolean(agentId),
    queryFn: async () => {
      const url = new URL(`${apiBaseUrl}/api/memories`)
      url.searchParams.set("agentId", agentId)
      if (search.trim()) url.searchParams.set("query", search.trim())
      const res = await fetch(url.toString(), {
        headers: getAuthHeaders(),
        credentials: "include",
      })
      if (!res.ok) return []
      const json = await res.json()
      return (json.memories || []) as MemoryItem[]
    },
  })

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${apiBaseUrl}/api/memories`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({
          agentId,
          key: newKey.trim(),
          content: newContent.trim(),
          category: newCategory.trim() || "general",
        }),
      })
      if (!res.ok) throw new Error("Failed to save memory")
      return res.json()
    },
    onSuccess: () => {
      setNewKey("")
      setNewContent("")
      setNewCategory("general")
      setIsAdding(false)
      queryClient.invalidateQueries({ queryKey: ["memories", agentId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(
        `${apiBaseUrl}/api/memories/${id}?agentId=${agentId}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
          credentials: "include",
        }
      )
      if (!res.ok) throw new Error("Failed to delete memory")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories", agentId] })
    },
  })

  return (
    <div className="flex h-full flex-col gap-4 px-3">
      <div className="flex items-center gap-2">
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <IconSearch />
          </InputGroupAddon>
          <InputGroupInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${agentName || "agent"}'s memories...`}
          />
        </InputGroup>
        <Button size="icon" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? <X /> : <IconPlus />}
        </Button>
      </div>

      {isAdding && (
        <div className="space-y-3 rounded-lg border bg-card p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">
                Key / Topic
              </label>
              <Input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g. user_preference"
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">
                Category
              </label>
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="general, facts, rules..."
                className="mt-1 text-xs"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">
              Memory Content
            </label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="What should this agent remember?"
              rows={2}
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              disabled={
                !newKey.trim() || !newContent.trim() || addMutation.isPending
              }
              onClick={() => addMutation.mutate()}
              className="text-xs"
            >
              {addMutation.isPending ? <Spinner className="size-3" /> : "Save"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : memories.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <p className="font-medium text-foreground">No memories saved yet</p>
            <p className="max-w-xs text-[11px]">
              This agent can automatically save memories during conversations,
              or you can add them manually above.
            </p>
          </div>
        ) : (
          memories.map((m) => (
            <div
              key={m.id}
              className="group relative rounded-lg border bg-secondary p-3 text-secondary-foreground transition-colors hover:border-foreground/20"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {m.key}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {m.category}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
                    {m.content}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground/60">
                    Updated {new Date(m.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                  onClick={() => deleteMutation.mutate(m.id)}
                  title="Delete memory"
                >
                  <IconTrash className="size-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
