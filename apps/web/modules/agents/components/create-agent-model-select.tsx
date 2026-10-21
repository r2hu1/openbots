"use client"

import {
  Field,
  FieldLabel,
} from "@openbots/ui/components/field"
import {
  NativeSelect,
  NativeSelectOption,
} from "@openbots/ui/components/native-select"
import * as React from "react"
import type { AvailableModel } from "../types"

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic Claude",
  deepseek: "DeepSeek",
  groq: "Groq",
  xai: "xAI Grok",
  openrouter: "OpenRouter",
}

interface CreateAgentModelSelectProps {
  availableModels: AvailableModel[]
  model: string
  onModelChange: (model: string) => void
}

export function CreateAgentModelSelect({
  availableModels,
  model,
  onModelChange,
}: CreateAgentModelSelectProps) {
  const [selectedProvider, setSelectedProvider] = React.useState<string>("google")

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

  React.useEffect(() => {
    if (providerKeys.length > 0 && !modelsByProvider[selectedProvider]) {
      setSelectedProvider(providerKeys[0] || "")
    }
  }, [providerKeys, selectedProvider, modelsByProvider])

  const currentProviderModels = modelsByProvider[selectedProvider] || []

  React.useEffect(() => {
    if (currentProviderModels.length > 0) {
      const hasCurrent = currentProviderModels.some((m) => m.id === model)
      if (!hasCurrent && currentProviderModels[0]) {
        onModelChange(currentProviderModels[0].id)
      }
    }
  }, [selectedProvider, currentProviderModels, model, onModelChange])

  if (providerKeys.length === 0) {
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
        No LLM API keys configured yet. Please configure a provider in Settings &gt; API Keys to create an agent.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <Field>
        <FieldLabel htmlFor="provider">Provider *</FieldLabel>
        <NativeSelect
          id="provider"
          value={selectedProvider}
          onChange={(e) => {
            const newP = e.target.value
            setSelectedProvider(newP)
            const firstModel = modelsByProvider[newP]?.[0]?.id
            if (firstModel) onModelChange(firstModel)
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
          onChange={(e) => onModelChange(e.target.value)}
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
  )
}
