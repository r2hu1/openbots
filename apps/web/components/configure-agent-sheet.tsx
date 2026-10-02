"use client"

import { Badge } from "@openbots/ui/components/badge"
import { Button } from "@openbots/ui/components/button"
import { Field, FieldGroup, FieldLabel } from "@openbots/ui/components/field"
import { Input } from "@openbots/ui/components/input"
import {
  NativeSelect,
  NativeSelectOption,
} from "@openbots/ui/components/native-select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@openbots/ui/components/sheet"
import { Spinner } from "@openbots/ui/components/spinner"
import { Switch } from "@openbots/ui/components/switch"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openbots/ui/components/tabs"
import { Textarea } from "@openbots/ui/components/textarea"
import { IconCheck, IconSettings } from "@tabler/icons-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { getClient } from "@/lib/api"

export type AgentData = {
  id: string
  name: string
  description: string | null
  instructions: string
  model: string
  maxSteps: number
  autonomy: string
  status: string
}

export type AgentToolItem = {
  id: string
  agentId: string
  toolName: string
  provider: "internal" | "composio" | "mcp"
  enabled: boolean
  config: unknown
}

interface ConfigureAgentSheetProps {
  agent: AgentData | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Native scroll container with a thin, always-visible scrollbar.
const SCROLL_CLASS =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 " +
  "[scrollbar-gutter:stable] [scrollbar-width:thin] " +
  "[scrollbar-color:color-mix(in_oklab,currentColor_25%,transparent)_transparent]"

const TOOL_DESCRIPTIONS: Record<string, string> = {
  get_current_time: "Provides real-time timestamp and timezone calculations.",
  calculate: "Evaluates mathematical expressions safely.",
  create_schedule: "Creates recurring scheduled tasks and automated runs.",
}

export function ConfigureAgentSheet({
  agent,
  open,
  onOpenChange,
}: ConfigureAgentSheetProps) {
  const queryClient = useQueryClient()

  // Form states
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [instructions, setInstructions] = React.useState("")
  const [model, setModel] = React.useState("google/gemini-2.5-flash")
  const [maxSteps, setMaxSteps] = React.useState(10)
  const [saveSuccess, setSaveSuccess] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)

  // Sync state with agent prop
  React.useEffect(() => {
    if (agent) {
      setName(agent.name)
      setDescription(agent.description || "")
      setInstructions(agent.instructions)
      setModel(agent.model)
      setMaxSteps(agent.maxSteps || 10)
      setSaveSuccess(false)
      setSaveError(null)
    }
  }, [agent])

  // Query available live models
  const { data: modelsData } = useQuery({
    queryKey: ["available-models"],
    queryFn: async () => {
      const client = getClient()
      const res = await client.api.agents.models.$get()
      if (!res.ok) return { models: [] }
      return res.json() as Promise<{
        models: Array<{
          id: string
          displayName: string
          description?: string
        }>
      }>
    },
    enabled: open,
  })

  const availableModels = modelsData?.models || []

  // Query agent tools
  const { data: toolsData, isLoading: isLoadingTools } = useQuery({
    queryKey: ["agent-tools", agent?.id],
    queryFn: async () => {
      if (!agent?.id) return { tools: [] }
      const client = getClient()
      const res = await client.api.agents[":id"].tools.$get({
        param: { id: agent.id },
      })
      if (!res.ok) throw new Error("Failed to fetch tools")
      return res.json() as Promise<{ tools: AgentToolItem[] }>
    },
    enabled: open && !!agent?.id,
  })

  // Update agent mutation
  const updateAgentMutation = useMutation({
    mutationFn: async () => {
      if (!agent?.id) return
      setSaveError(null)
      setSaveSuccess(false)

      const client = getClient()
      const res = await client.api.agents[":id"].$patch({
        param: { id: agent.id },
        json: {
          name: name.trim(),
          description: description.trim() || undefined,
          instructions: instructions.trim(),
          model,
          maxSteps: Number(maxSteps) || 10,
        },
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data?.error || "Failed to update agent")
      }

      return res.json()
    },
    onSuccess: () => {
      setSaveSuccess(true)
      queryClient.invalidateQueries({ queryKey: ["agents"] })
      queryClient.invalidateQueries({ queryKey: ["agent", agent?.id] })
      setTimeout(() => setSaveSuccess(false), 2500)
    },
    onError: (err: Error) => {
      setSaveError(err.message)
    },
  })

  const deleteAgentMutation = useMutation({
    mutationFn: async () => {
      if (!agent?.id) return
      const client = getClient()
      const res = await client.api.agents[":id"].$delete({
        param: { id: agent.id },
      })
      if (!res.ok) throw new Error("Failed to delete agent")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] })
      onOpenChange(false)
      if (typeof window !== "undefined") {
        window.location.href = "/"
      }
    },
    onError: (err: Error) => {
      setSaveError(err.message)
    },
  })

  // Toggle tool mutation
  const toggleToolMutation = useMutation({
    mutationFn: async ({
      toolName,
      provider,
      enabled,
    }: {
      toolName: string
      provider: "internal" | "composio" | "mcp"
      enabled: boolean
    }) => {
      if (!agent?.id) return
      const client = getClient()
      const res = await client.api.agents[":id"].tools.$post({
        param: { id: agent.id },
        json: {
          toolName,
          provider,
          enabled,
        },
      })

      if (!res.ok) {
        throw new Error("Failed to update tool")
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-tools", agent?.id] })
    },
  })

  if (!agent) return null

  const tools = toolsData?.tools ?? []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Configure agent</SheetTitle>
          <SheetDescription>
            Adjust instructions, loop limits, and which tools this agent can
            use.
          </SheetDescription>
        </SheetHeader>

        <Tabs
          defaultValue="general"
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4"
        >
          <TabsList className="grid w-full shrink-0 grid-cols-2">
            <TabsTrigger value="general">Configuration</TabsTrigger>
            <TabsTrigger value="tools">
              Tools{tools.length ? ` (${tools.length})` : ""}
            </TabsTrigger>
          </TabsList>

          {/* Configuration tab */}
          <TabsContent value="general" className={SCROLL_CLASS}>
            <form
              id="configure-agent-form"
              onSubmit={(e) => {
                e.preventDefault()
                updateAgentMutation.mutate()
              }}
              className="space-y-4 pb-4"
            >
              {saveSuccess && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <IconCheck className="size-3.5" />
                  Configuration saved.
                </div>
              )}

              {saveError && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive">
                  {saveError}
                </div>
              )}

              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="cfg-name">Agent name</FieldLabel>
                  <Input
                    id="cfg-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="cfg-desc">Description</FieldLabel>
                  <Input
                    id="cfg-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="cfg-instructions">
                    System instructions
                  </FieldLabel>
                  <Textarea
                    id="cfg-instructions"
                    rows={8}
                    className="font-mono text-xs"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    required
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="cfg-model">Model</FieldLabel>
                    <NativeSelect
                      id="cfg-model"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full text-xs"
                    >
                      {availableModels.length > 0 ? (
                        availableModels.map((m) => (
                          <NativeSelectOption key={m.id} value={m.id}>
                            {m.displayName}
                          </NativeSelectOption>
                        ))
                      ) : (
                        <>
                          <NativeSelectOption value="google/gemini-2.5-flash">
                            Gemini 2.5 Flash
                          </NativeSelectOption>
                          <NativeSelectOption value="google/gemini-2.5-pro">
                            Gemini 2.5 Pro
                          </NativeSelectOption>
                          <NativeSelectOption value="google/gemini-2.0-flash">
                            Gemini 2.0 Flash
                          </NativeSelectOption>
                        </>
                      )}
                    </NativeSelect>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="cfg-steps">Max steps</FieldLabel>
                    <Input
                      id="cfg-steps"
                      type="number"
                      min={1}
                      max={50}
                      value={maxSteps}
                      onChange={(e) => setMaxSteps(Number(e.target.value))}
                    />
                  </Field>
                </div>
              </FieldGroup>
            </form>
          </TabsContent>

          {/* Tools tab */}
          <TabsContent value="tools" className={SCROLL_CLASS}>
            <div className="space-y-3 pb-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Choose which tools the agent can call during its multi-step
                loop.
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
          </TabsContent>
        </Tabs>

        <SheetFooter className="flex flex-col gap-2 border-t border-border p-3">
          <Button
            type="submit"
            form="configure-agent-form"
            className="h-8 w-full text-xs"
            disabled={updateAgentMutation.isPending}
          >
            {updateAgentMutation.isPending && (
              <Spinner data-icon="inline-start" />
            )}
            Save changes
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="h-8 w-full text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={deleteAgentMutation.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `Are you sure you want to delete "${agent.name}"? This cannot be undone.`
                )
              ) {
                deleteAgentMutation.mutate()
              }
            }}
          >
            {deleteAgentMutation.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              "Delete agent"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
