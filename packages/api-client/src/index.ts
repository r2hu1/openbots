import type { AppType } from "@openbots/api-contract"
import { hc } from "hono/client"

export type { AppType } from "@openbots/api-contract"

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
}

export function createClient(
  baseUrl?: string,
  options?: Parameters<typeof hc>[1]
) {
  const url = baseUrl ?? getApiBaseUrl()
  return hc<AppType>(url, options)
}

export const api = createClient

export type Client = ReturnType<typeof createClient>
