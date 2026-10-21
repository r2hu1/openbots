"use client"

import { Button } from "@openbots/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openbots/ui/components/dialog"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@openbots/ui/components/field"
import { Input } from "@openbots/ui/components/input"
import { Spinner } from "@openbots/ui/components/spinner"
import { Textarea } from "@openbots/ui/components/textarea"
import { toast } from "@openbots/ui/components/toast"
import * as React from "react"
import { useCreateAutoScheduleMutation } from "@/modules/schedules/queries"
import { useAvailableModelsQuery, useCreateAgentMutation } from "../queries"
import { CreateAgentModelSelect } from "./create-agent-model-select"
import { CreateAgentScheduleField } from "./create-agent-schedule-field"

interface CreateAgentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAgentCreated: (agentId: string) => void
}

export function CreateAgentDialog({
  open,
  onOpenChange,
  onAgentCreated,
}: CreateAgentDialogProps) {
  const { data: availableModels = [] } = useAvailableModelsQuery(open)

  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [instructions, setInstructions] = React.useState(
    "You are a helpful assistant. Use tools when helpful to answer questions."
  )
  const [scheduledTask, setScheduledTask] = React.useState("")
  const [model, setModel] = React.useState("google/gemini-2.5-flash")
  const [autonomy, _setAutonomy] = React.useState<"manual">("manual")
  const [error, setError] = React.useState<string | null>(null)

  const autoScheduleMutation = useCreateAutoScheduleMutation()

  const createMutation = useCreateAgentMutation({
    onSuccess: (newId) => {
      const scheduledPrompt = scheduledTask.trim()
      onOpenChange(false)
      setName("")
      setDescription("")
      setScheduledTask("")
      onAgentCreated(newId)

      if (scheduledPrompt) {
        const clientTz =
          Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || "UTC"
        autoScheduleMutation.mutate(
          {
            agentId: newId,
            prompt: scheduledPrompt,
            timezone: clientTz,
          },
          {
            onSuccess: (data) => {
              toast.add({
                title: "Scheduled Task Created",
                description: `Created schedule: ${data.schedule.name}`,
              })
            },
            onError: (err) => {
              toast.add({
                title: "Could Not Set Schedule",
                description: err.message,
              })
            },
          }
        )
      }
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("Agent name is required.")
      return
    }
    setError(null)
    createMutation.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        instructions: instructions.trim(),
        model,
        autonomy,
      },
      {
        onError: (err) => {
          setError(err.message)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Agent</DialogTitle>
            <DialogDescription>
              Configure the identity, instructions, and execution boundaries for
              your agent.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="no-scrollbar max-h-[70vh] gap-4 overflow-y-auto px-1 py-4">
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <Field>
              <FieldLabel htmlFor="name">Name *</FieldLabel>
              <Input
                id="name"
                placeholder="e.g. Research Assistant"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="description">
                Role / Description (optional)
              </FieldLabel>
              <Input
                id="description"
                placeholder="e.g. Researches documentation and executes safe tools"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="instructions">
                System Instructions *
              </FieldLabel>
              <Textarea
                id="instructions"
                rows={3}
                className="font-mono text-xs"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                required
              />
            </Field>

            <CreateAgentScheduleField
              value={scheduledTask}
              onChange={setScheduledTask}
            />

            <CreateAgentModelSelect
              availableModels={availableModels}
              model={model}
              onModelChange={setModel}
            />
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Spinner data-icon="inline-start" />}
              Create Agent
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
