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
  IconBrandAirtable,
  IconBrandAsana,
  IconBrandDiscord,
  IconBrandGithub,
  IconBrandGmail,
  IconBrandGoogleDrive,
  IconBrandJira,
  IconBrandNotion,
  IconBrandSlack,
  IconBrandSpotify,
  IconBrandStripe,
  IconBrandTrello,
  IconBrandYoutube,
  IconBrandZoom,
  IconCalendar,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import * as React from "react"

import { getClient } from "@/lib/api"

interface ConnectionsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Connection = {
  id: string
  provider: string
  externalAccountId: string
  status: string
  createdAt: string
}

const AVAILABLE_INTEGRATIONS = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Send emails, draft replies, and query inbox messages.",
    icon: IconBrandGmail,
    accountId: "gmail_connected_account",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Read, write, search, and update databases and docs.",
    icon: IconBrandNotion,
    accountId: "notion_connected_account",
  },
  {
    id: "github",
    name: "GitHub",
    description:
      "Manage repositories, pull requests, issues, and code reviews.",
    icon: IconBrandGithub,
    accountId: "github_connected_account",
  },
  {
    id: "slack",
    name: "Slack",
    description:
      "Post messages, read channels, and automate team notifications.",
    icon: IconBrandSlack,
    accountId: "slack_connected_account",
  },
  {
    id: "googlecalendar",
    name: "Google Calendar",
    description:
      "Schedule events, check availability, and manage calendar meetings.",
    icon: IconCalendar,
    accountId: "googlecalendar_connected_account",
  },
  {
    id: "discord",
    name: "Discord",
    description:
      "Send channel messages, trigger webhooks, and interact with servers.",
    icon: IconBrandDiscord,
    accountId: "discord_connected_account",
  },
  {
    id: "googledrive",
    name: "Google Drive",
    description: "Search, organize, upload, and read files from Google Drive.",
    icon: IconBrandGoogleDrive,
    accountId: "googledrive_connected_account",
  },
  {
    id: "jira",
    name: "Jira",
    description: "Create issues, track sprints, and query development tickets.",
    icon: IconBrandJira,
    accountId: "jira_connected_account",
  },
  {
    id: "trello",
    name: "Trello",
    description:
      "Manage boards, create task cards, and automate project workflows.",
    icon: IconBrandTrello,
    accountId: "trello_connected_account",
  },
  {
    id: "asana",
    name: "Asana",
    description:
      "Coordinate team tasks, project milestones, and assignment statuses.",
    icon: IconBrandAsana,
    accountId: "asana_connected_account",
  },
  {
    id: "airtable",
    name: "Airtable",
    description:
      "Query relational records, add rows, and update spreadsheet databases.",
    icon: IconBrandAirtable,
    accountId: "airtable_connected_account",
  },
  {
    id: "stripe",
    name: "Stripe",
    description:
      "View customer billing, search payments, invoices, and subscriptions.",
    icon: IconBrandStripe,
    accountId: "stripe_connected_account",
  },
  {
    id: "spotify",
    name: "Spotify",
    description:
      "Control playback, browse playlists, and search music libraries.",
    icon: IconBrandSpotify,
    accountId: "spotify_connected_account",
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "Search videos, manage playlists, and read channel analytics.",
    icon: IconBrandYoutube,
    accountId: "youtube_connected_account",
  },
  {
    id: "zoom",
    name: "Zoom",
    description:
      "Create video meetings, manage recordings, and access schedule links.",
    icon: IconBrandZoom,
    accountId: "zoom_connected_account",
  },
] as const

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 120_000

const SCROLL_CLASS =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain " +
  "[scrollbar-gutter:stable] [scrollbar-width:thin]"

export function ConnectionsSheet({
  open,
  onOpenChange,
}: ConnectionsSheetProps) {
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = React.useState("")
  const [pollingEnabled, setPollingEnabled] = React.useState(false)

  const baselineCount = React.useRef(0)
  const pollTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: connectionsData, isLoading } = useQuery({
    queryKey: ["connections"],
    enabled: open,
    queryFn: async () => {
      const client = getClient()
      const response = await client.api.connections.$get()

      if (!response.ok) {
        throw new Error("Failed to load connections")
      }

      return response.json() as Promise<{
        connections: Connection[]
      }>
    },
    refetchInterval: pollingEnabled ? POLL_INTERVAL_MS : false,
  })

  const connections = connectionsData?.connections ?? []

  /**
   * Stop OAuth polling once a new connection appears.
   */
  React.useEffect(() => {
    if (pollingEnabled && connections.length > baselineCount.current) {
      setPollingEnabled(false)

      if (pollTimeout.current) {
        clearTimeout(pollTimeout.current)
        pollTimeout.current = null
      }
    }
  }, [connections.length, pollingEnabled])

  /**
   * Cleanup polling timeout.
   */
  React.useEffect(() => {
    return () => {
      if (pollTimeout.current) {
        clearTimeout(pollTimeout.current)
      }
    }
  }, [])

  /**
   * Reset search when the sheet closes.
   */
  React.useEffect(() => {
    if (!open) {
      setSearchQuery("")
      setPollingEnabled(false)

      if (pollTimeout.current) {
        clearTimeout(pollTimeout.current)
        pollTimeout.current = null
      }
    }
  }, [open])

  const connectMutation = useMutation({
    mutationFn: async ({ appName }: { appName: string }) => {
      const client = getClient()

      const response = await client.api.connections.initiate.$post({
        json: { appName },
      })

      if (!response.ok) {
        throw new Error("Failed to initiate connection")
      }

      return response.json() as Promise<{
        redirectUrl: string
      }>
    },

    onSuccess: (data) => {
      if (!data.redirectUrl) {
        return
      }

      baselineCount.current = connections.length

      window.open(data.redirectUrl, "_blank", "noopener,noreferrer")

      setPollingEnabled(true)

      if (pollTimeout.current) {
        clearTimeout(pollTimeout.current)
      }

      pollTimeout.current = setTimeout(() => {
        setPollingEnabled(false)
        pollTimeout.current = null
      }, POLL_TIMEOUT_MS)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const client = getClient()

      const response = await client.api.connections[":id"].$delete({
        param: { id },
      })

      if (!response.ok) {
        throw new Error("Failed to disconnect integration")
      }

      return response.json()
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["connections"],
      })
    },
  })

  const filteredIntegrations = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) {
      return AVAILABLE_INTEGRATIONS
    }

    return AVAILABLE_INTEGRATIONS.filter((integration) => {
      return (
        integration.name.toLowerCase().includes(query) ||
        integration.description.toLowerCase().includes(query) ||
        integration.id.toLowerCase().includes(query)
      )
    })
  }, [searchQuery])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full max-h-screen flex-col overflow-hidden sm:max-w-md!"
      >
        <SheetHeader className="shrink-0">
          <SheetTitle>Integrations & Connections</SheetTitle>

          <SheetDescription>
            Connect your SaaS tools so your agents can take real actions across
            popular apps.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden px-4">
          <h3 className="shrink-0 text-xs font-medium text-muted-foreground">
            Supported integrations ({AVAILABLE_INTEGRATIONS.length})
          </h3>

          <div className="relative shrink-0">
            <IconSearch
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            />

            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search apps (GitHub, Slack, Drive...)"
              className="h-9 w-full rounded-md border border-input bg-transparent pr-3 pl-8 text-xs shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <div className={SCROLL_CLASS}>
            <div className="overflow-hidden rounded-xl border border-border">
              {isLoading ? (
                <div className="flex min-h-40 items-center justify-center">
                  <Spinner className="size-5" />
                </div>
              ) : filteredIntegrations.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No apps match &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredIntegrations.map((integration) => {
                    const Icon = integration.icon

                    const activeConnection = connections.find(
                      (connection) =>
                        connection.externalAccountId ===
                          integration.accountId ||
                        connection.provider === integration.id ||
                        connection.externalAccountId
                          .toLowerCase()
                          .includes(integration.id)
                    )

                    const isConnected = Boolean(activeConnection)

                    const isWaitingForAuth =
                      pollingEnabled &&
                      !isConnected &&
                      connectMutation.variables?.appName === integration.id

                    const isConnecting =
                      connectMutation.isPending &&
                      connectMutation.variables?.appName === integration.id

                    const isDisconnecting =
                      deleteMutation.isPending &&
                      deleteMutation.variables === activeConnection?.id

                    const isPending =
                      isConnecting || isWaitingForAuth || isDisconnecting

                    return (
                      <div
                        key={integration.id}
                        className="flex items-center gap-3 px-3 py-2.5"
                      >
                        {/* App icon */}
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                          <Icon className="size-4.5" />
                        </div>

                        {/* App information */}
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-xs font-semibold text-foreground">
                              {integration.name}
                            </span>

                            {isConnected && (
                              <span className="flex shrink-0 items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                                <span className="size-1.5 rounded-full bg-emerald-500" />
                                Connected
                              </span>
                            )}
                          </div>

                          <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-muted-foreground">
                            {isWaitingForAuth
                              ? "Finish signing in in the new tab…"
                              : integration.description}
                          </p>
                        </div>

                        {/* Action */}
                        {isConnected ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            className="shrink-0 gap-1 text-[11px]"
                            disabled={isPending}
                            onClick={() => {
                              if (activeConnection) {
                                deleteMutation.mutate(activeConnection.id)
                              }
                            }}
                          >
                            {isDisconnecting && <Spinner className="size-3" />}
                            Disconnect
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="xs"
                            className="shrink-0 gap-1 text-[11px]"
                            disabled={isPending}
                            onClick={() =>
                              connectMutation.mutate({
                                appName: integration.id,
                              })
                            }
                          >
                            {isConnecting || isWaitingForAuth ? (
                              <Spinner className="size-3" />
                            ) : (
                              <IconPlus className="size-3" />
                            )}

                            {isWaitingForAuth ? "Waiting" : "Connect"}
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
