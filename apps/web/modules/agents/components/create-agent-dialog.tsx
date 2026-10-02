"use client";

import { Button } from "@openbots/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openbots/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@openbots/ui/components/field";
import { Input } from "@openbots/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@openbots/ui/components/native-select";
import { Spinner } from "@openbots/ui/components/spinner";
import { Textarea } from "@openbots/ui/components/textarea";
import * as React from "react";
import { DEFAULT_MODELS } from "../constants";
import { useAvailableModelsQuery, useCreateAgentMutation } from "../queries";

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgentCreated: (agentId: string) => void;
}

export function CreateAgentDialog({
  open,
  onOpenChange,
  onAgentCreated,
}: CreateAgentDialogProps) {
  const { data: availableModels = [] } = useAvailableModelsQuery(open);

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [instructions, setInstructions] = React.useState(
    "You are a helpful assistant. Use tools when helpful to answer questions.",
  );
  const [model, setModel] = React.useState("google/gemini-2.5-flash");
  const [maxSteps, setMaxSteps] = React.useState(10);
  const [autonomy, _setAutonomy] = React.useState<"manual">("manual");
  const [error, setError] = React.useState<string | null>(null);

  const createMutation = useCreateAgentMutation({
    onSuccess: (newId) => {
      onOpenChange(false);
      setName("");
      setDescription("");
      onAgentCreated(newId);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Agent name is required.");
      return;
    }
    setError(null);
    createMutation.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        instructions: instructions.trim(),
        model,
        maxSteps: Number(maxSteps) || 10,
        autonomy,
      },
      {
        onError: (err) => {
          setError(err.message);
        },
      },
    );
  };

  const modelsList =
    availableModels.length > 0 ? availableModels : DEFAULT_MODELS;

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

          <FieldGroup className="gap-4 py-4">
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
                Description (optional)
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
                rows={4}
                className="font-mono text-xs"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="model">Model</FieldLabel>
                <NativeSelect
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full text-xs"
                >
                  {modelsList.map((m) => (
                    <NativeSelectOption key={m.id} value={m.id}>
                      {m.displayName}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>

              <Field>
                <FieldLabel htmlFor="maxSteps">Max Steps</FieldLabel>
                <Input
                  id="maxSteps"
                  type="number"
                  min={1}
                  max={50}
                  value={maxSteps}
                  onChange={(e) => setMaxSteps(Number(e.target.value))}
                />
              </Field>
            </div>
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
  );
}
