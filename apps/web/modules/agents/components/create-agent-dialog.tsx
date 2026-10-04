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
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@openbots/ui/components/native-select";
import { Spinner } from "@openbots/ui/components/spinner";
import { Textarea } from "@openbots/ui/components/textarea";
import * as React from "react";
import { useAvailableModelsQuery, useCreateAgentMutation } from "../queries";

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgentCreated: (agentId: string) => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic Claude",
  deepseek: "DeepSeek",
  groq: "Groq",
  xai: "xAI Grok",
  openrouter: "OpenRouter",
};

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
  const [maxSteps, setMaxSteps] = React.useState(25);
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

  const [selectedProvider, setSelectedProvider] =
    React.useState<string>("google");

  // Group models by provider
  const modelsByProvider = React.useMemo(() => {
    const groups: Record<string, typeof availableModels> = {};
    for (const m of availableModels) {
      const p = m.provider || m.id.split("/")[0] || "other";
      if (!groups[p]) groups[p] = [];
      groups[p].push(m);
    }
    return groups;
  }, [availableModels]);

  const providerKeys = Object.keys(modelsByProvider);

  // Sync selected provider when available providers load
  React.useEffect(() => {
    if (providerKeys.length > 0 && !modelsByProvider[selectedProvider]) {
      setSelectedProvider(providerKeys[0] || "");
    }
  }, [providerKeys, selectedProvider, modelsByProvider]);

  // Sync model when selectedProvider or models change
  const currentProviderModels = modelsByProvider[selectedProvider] || [];
  React.useEffect(() => {
    if (currentProviderModels.length > 0) {
      const hasCurrent = currentProviderModels.some((m) => m.id === model);
      if (!hasCurrent && currentProviderModels[0]) {
        setModel(currentProviderModels[0].id);
      }
    }
  }, [selectedProvider, currentProviderModels, model]);

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
                rows={4}
                className="font-mono text-xs"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                required
              />
            </Field>

            {providerKeys.length === 0 ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
                No LLM API keys configured yet. Please configure a provider in
                Settings &gt; API Keys to create an agent.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="provider">Provider *</FieldLabel>
                  <NativeSelect
                    id="provider"
                    value={selectedProvider}
                    onChange={(e) => {
                      const newP = e.target.value;
                      setSelectedProvider(newP);
                      const firstModel = modelsByProvider[newP]?.[0]?.id;
                      if (firstModel) setModel(firstModel);
                    }}
                    className="w-full text-xs"
                  >
                    {providerKeys.map((p) => (
                      <NativeSelectOption key={p} value={p}>
                        {PROVIDER_LABELS[p] || p.toUpperCase()}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>

                <Field>
                  <FieldLabel htmlFor="model">Model *</FieldLabel>
                  <NativeSelect
                    id="model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full text-xs"
                  >
                    {currentProviderModels.map((m) => (
                      <NativeSelectOption key={m.id} value={m.id}>
                        {m.displayName}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
            )}

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
