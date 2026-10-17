"use client"

import { Spinner } from "@openbots/ui/components/spinner"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import {
  ConfiguredKeyInfo,
  LLM_PROVIDERS,
} from "./api-keys-constants"
import { ProviderKeyRow } from "./provider-key-row"
import { Panel, SectionHeader } from "./settings-shared"

export type {
  ConfiguredKeyInfo,
  ProviderKeyMeta,
  SupportedLlmProvider,
} from "./api-keys-constants"
export { LLM_PROVIDERS } from "./api-keys-constants"

const NO_KEYS: Record<string, ConfiguredKeyInfo> = {}

export function ApiKeysTab() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const apiBaseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
      const headers: Record<string, string> = {}
      if (typeof window !== "undefined") {
        const token =
          localStorage.getItem("bearer_token") ||
          localStorage.getItem("better-auth_token")
        if (token) headers.Authorization = `Bearer ${token}`
      }

      const res = await fetch(`${apiBaseUrl}/api/api-keys`, {
        headers,
        credentials: "include",
      })
      if (!res.ok) return NO_KEYS
      const json = (await res.json()) as { keys?: ConfiguredKeyInfo[] }
      const map: Record<string, ConfiguredKeyInfo> = {}
      for (const key of json.keys ?? []) map[key.provider] = key
      return map
    },
  })

  const configuredKeys = data ?? NO_KEYS

  const refresh = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
    [queryClient]
  )

  return (
    <>
      <SectionHeader
        title="API keys"
        description="Agents run on your own model keys. Keys are encrypted with AES-256-GCM before storage and are never shown back in plaintext."
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-5" />
        </div>
      ) : (
        <Panel>
          {LLM_PROVIDERS.map((meta) => (
            <ProviderKeyRow
              key={meta.provider}
              meta={meta}
              configured={configuredKeys[meta.provider]}
              onChanged={refresh}
            />
          ))}
        </Panel>
      )}
    </>
  )
}
