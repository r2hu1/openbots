"use client"

import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@openbots/ui/components/field"
import { Input } from "@openbots/ui/components/input"
import {
  NativeSelect,
  NativeSelectOption,
} from "@openbots/ui/components/native-select"
import { Textarea } from "@openbots/ui/components/textarea"
import { IconCheck } from "@tabler/icons-react"
import * as React from "react"

export const PROVIDER_LABELS: Record<string, string> = {
  google: "Google Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic Claude",
  deepseek: "DeepSeek",
  groq: "Groq",
  xai: "xAI Grok",
  openrouter: "OpenRouter",
}

interface ConfigureAgentGeneralTabProps {
  name: string
  setName: (name: string) => void
  description: string
  setDescription: (description: string) => void
  instructions: string
  setInstructions: (instructions: string) => void
  model: string
  setModel: (model: string) => void
  selectedProvider: string
  setSelectedProvider: (provider: string) => void
  providerKeys: string[]
  modelsByProvider: Record<string, Array<{ id: string; displayName?: string }>>
  currentProviderModels: Array<{ id: string; displayName?: string }>
  saveSuccess: boolean
  saveError: string | null
  onSubmit: (e: React.FormEvent) => void
}

export function ConfigureAgentGeneralTab({
  name,
  setName,
  description,
  setDescription,
  instructions,
  setInstructions,
  model,
  setModel,
  selectedProvider,
  setSelectedProvider,
  providerKeys,
  modelsByProvider,
  currentProviderModels,
  saveSuccess,
  saveError,
  onSubmit,
}: ConfigureAgentGeneralTabProps) {
  return (
    <form
      id="configure-agent-form"
      onSubmit={onSubmit}
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
          <FieldLabel htmlFor="cfg-instructions">System instructions</FieldLabel>
          <Textarea
            id="cfg-instructions"
            rows={8}
            className="max-h-40 font-mono text-xs"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            required
          />
        </Field>

        {providerKeys.length === 0 ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
            No LLM API keys configured yet. Please configure a provider in
            Settings &gt; API Keys.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="cfg-provider">Provider</FieldLabel>
              <NativeSelect
                id="cfg-provider"
                value={selectedProvider}
                onChange={(e) => {
                  const newP = e.target.value
                  setSelectedProvider(newP)
                  const firstModel = modelsByProvider[newP]?.[0]?.id
                  if (firstModel) setModel(firstModel)
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
              <FieldLabel htmlFor="cfg-model">Model</FieldLabel>
              <NativeSelect
                id="cfg-model"
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
      </FieldGroup>
    </form>
  )
}
