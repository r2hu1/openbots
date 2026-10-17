"use client"

import { Button } from "@openbots/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@openbots/ui/components/sheet"
import { Spinner } from "@openbots/ui/components/spinner"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openbots/ui/components/tabs"
import { IconTrash } from "@tabler/icons-react"
import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import {
  useAgentToolsQuery,
  useAvailableModelsQuery,
  useToggleAgentToolMutation,
  useUpdateAgentMutation,
} from "../queries"
import type { Agent } from "../types"
import { ConfigureAgentGeneralTab } from "./configure-agent-general-tab"
import { ConfigureAgentToolsTab } from "./configure-agent-tools-tab"
import { DeleteAgentDialog } from "./delete-agent-dialog"

interface ConfigureAgentSheetProps {
  agent: Agent | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SCROLL_CLASS =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain " +
  "[scrollbar-gutter:stable] [scrollbar-width:thin] " +
  "[scrollbar-color:color-mix(in_oklab,currentColor_25%,transparent)_transparent]"

export function ConfigureAgentSheet({
  agent,
  open,
  onOpenChange,
}: ConfigureAgentSheetProps) {
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [instructions, setInstructions] = React.useState("")
  const [model, setModel] = React.useState("google/gemini-2.5-flash")
  const [saveSuccess, setSaveSuccess] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)

  const [selectedProvider, setSelectedProvider] =
    React.useState<string>("google")

  const { data: availableModels = [] } = useAvailableModelsQuery(open)

  // Group models by provider
  const modelsByProvider = React.useMemo(() => {
    const groups: Record<string, typeof availableModels> = {}
    for (const m of availableModels) {
      const p = m.provider || m.id.split("/")[0] || "other"
      if (!groups[p]) groups[p] = []
      groups[p].push(m)
    }
    return groups
  }, [availableModels])

  const providerKeys = Object.keys(modelsByProvider)

  const { data: tools = [], isLoading: isLoadingTools } = useAgentToolsQuery(
    agent?.id,
    open
  )

  const queryClient = useQueryClient()
  const updateMutation = useUpdateAgentMutation(agent?.id)
  const toggleToolMutation = useToggleAgentToolMutation(agent?.id)

  React.useEffect(() => {
    if (agent) {
      setName(agent.name)
      setDescription(agent.description || "")
      setInstructions(agent.instructions)
      setModel(agent.model)
      const agentProvider = agent.model.split("/")[0] || "google"
      setSelectedProvider(agentProvider)
      setSaveSuccess(false)
      setSaveError(null)
    }
  }, [agent])

  // Sync selectedProvider if not present
  React.useEffect(() => {
    if (providerKeys.length > 0 && !modelsByProvider[selectedProvider]) {
      setSelectedProvider(providerKeys[0] || "")
    }
  }, [providerKeys, selectedProvider, modelsByProvider])

  // Sync model with selectedProvider
  const currentProviderModels = modelsByProvider[selectedProvider] || []
  React.useEffect(() => {
    if (currentProviderModels.length > 0) {
      const hasCurrent = currentProviderModels.some((m) => m.id === model)
      if (!hasCurrent && currentProviderModels[0]) {
        setModel(currentProviderModels[0].id)
      }
    }
  }, [selectedProvider, currentProviderModels, model])

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    setSaveError(null)
    setSaveSuccess(false)

    updateMutation.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        instructions: instructions.trim(),
        model,
      },
      {
        onSuccess: () => {
          setSaveSuccess(true)
          setTimeout(() => setSaveSuccess(false), 2500)
        },
        onError: (err) => {
          setSaveError(err.message)
        },
      }
    )
  }

  if (!agent) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left">
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

          <TabsContent value="general" className={SCROLL_CLASS}>
            <ConfigureAgentGeneralTab
              name={name}
              setName={setName}
              description={description}
              setDescription={setDescription}
              instructions={instructions}
              setInstructions={setInstructions}
              model={model}
              setModel={setModel}
              selectedProvider={selectedProvider}
              setSelectedProvider={setSelectedProvider}
              providerKeys={providerKeys}
              modelsByProvider={modelsByProvider}
              currentProviderModels={currentProviderModels}
              saveSuccess={saveSuccess}
              saveError={saveError}
              onSubmit={handleUpdate}
            />
          </TabsContent>

          <TabsContent value="tools" className={SCROLL_CLASS}>
            <ConfigureAgentToolsTab
              tools={tools}
              isLoadingTools={isLoadingTools}
              toggleToolMutation={toggleToolMutation}
            />
          </TabsContent>
        </Tabs>

        <SheetFooter className="w-full flex-row">
          <Button
            type="submit"
            form="configure-agent-form"
            className="flex-1"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending && <Spinner data-icon="inline-start" />}
            Save changes
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={() => setDeleteConfirmOpen(true)}
          >
            <IconTrash />
          </Button>

          <DeleteAgentDialog
            agent={agent}
            open={deleteConfirmOpen}
            onOpenChange={setDeleteConfirmOpen}
            onSuccess={(id) => {
              queryClient.invalidateQueries({ queryKey: ["agents"] })
              queryClient.removeQueries({ queryKey: ["agent", id] })
              queryClient.setQueryData(["agents"], (old: any) => {
                if (Array.isArray(old)) {
                  return old.filter((a: Agent) => a.id !== id)
                }
                if (old?.agents) {
                  return {
                    ...old,
                    agents: old.agents.filter((a: Agent) => a.id !== id),
                  }
                }
                return old
              })
              onOpenChange(false)
            }}
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
