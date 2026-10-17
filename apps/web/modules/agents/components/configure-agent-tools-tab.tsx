"use client"

import { Badge } from "@openbots/ui/components/badge"
import { Spinner } from "@openbots/ui/components/spinner"
import { Switch } from "@openbots/ui/components/switch"
import * as React from "react"
import { TOOL_DESCRIPTIONS } from "../constants"
import type { useToggleAgentToolMutation } from "../queries"

interface ToolItem {
  id: string
  toolName: string
  provider: "internal" | "composio" | "mcp"
  enabled: boolean
}

interface ConfigureAgentToolsTabProps {
  tools: ToolItem[]
  isLoadingTools: boolean
  toggleToolMutation: ReturnType<typeof useToggleAgentToolMutation>
}

export function ConfigureAgentToolsTab({
  tools,
  isLoadingTools,
  toggleToolMutation,
}: ConfigureAgentToolsTabProps) {
  return (
    <div className="space-y-3 pb-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Choose which tools the agent can call during its multi-step loop.
      </p>

      {isLoadingTools ? (
        <div className="flex items-center justify-center p-8">
          <Spinner className="size-5" />
        </div>
      ) : tools.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
          No tools available for this agent yet.
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {tools.map((tool) => {
            const rowPending =
              toggleToolMutation.isPending &&
              toggleToolMutation.variables?.toolName === tool.toolName

            return (
              <div
                key={tool.id}
                className="flex items-center gap-3 px-3.5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-xs font-medium text-foreground">
                      {tool.toolName}
                    </span>
                    <Badge
                      variant="outline"
                      className="h-4 shrink-0 py-0 text-[10px] text-muted-foreground"
                    >
                      {tool.provider}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {TOOL_DESCRIPTIONS[tool.toolName] ??
                      `External ${tool.provider} tool integration.`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {rowPending && <Spinner className="size-3" />}
                  <Switch
                    checked={tool.enabled}
                    onCheckedChange={(checked) =>
                      toggleToolMutation.mutate({
                        toolName: tool.toolName,
                        provider: tool.provider,
                        enabled: checked,
                      })
                    }
                    disabled={rowPending}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
