import type { AppType } from "@openbots/api-contract"
import { hc } from "hono/client"

export type { AppType } from "@openbots/api-contract"

function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }
  return "http://localhost:3000"
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
