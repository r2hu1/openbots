"use client"

import { Spinner } from "@openbots/ui/components/spinner"
import { IconSearch } from "@tabler/icons-react"
import * as React from "react"
import { AVAILABLE_INTEGRATIONS } from "@/modules/connections/constants"
import {
  useConnectionsQuery,
  useDeleteConnectionMutation,
  useInitiateConnectionMutation,
} from "@/modules/connections/queries"
import { IntegrationRow } from "@/modules/connections/components/integration-row"
import { SectionHeader } from "./settings-shared"

export function ConnectionsTab() {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [pendingAuthApp, setPendingAuthApp] = React.useState<string | null>(
    null
  )

  const {
    data: connections = [],
    isLoading,
    refetch: refetchConnections,
  } = useConnectionsQuery({
    refetchInterval: false,
  })

  const connectMutation = useInitiateConnectionMutation()
  const deleteMutation = useDeleteConnectionMutation()

  React.useEffect(() => {
    if (pendingAuthApp) {
      const isConnected = connections.some(
        (c) =>
          c.provider?.toLowerCase().includes(pendingAuthApp.toLowerCase()) ||
          c.externalAccountId
            ?.toLowerCase()
            .includes(pendingAuthApp.toLowerCase())
      )
      if (isConnected) {
        setPendingAuthApp(null)
      }
    }
  }, [connections, pendingAuthApp])

  React.useEffect(() => {
    if (!pendingAuthApp) return

    const handleFocus = () => {
      refetchConnections()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refetchConnections()
      }
    }

    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [pendingAuthApp, refetchConnections])

  const handleConnect = (appName: string) => {
    connectMutation.mutate(
      { appName },
      {
        onSuccess: (data) => {
          if (!data.redirectUrl) return
          setPendingAuthApp(appName)
          window.open(data.redirectUrl, "_blank", "noopener,noreferrer")
        },
      }
    )
  }

  const handleDisconnect = (connectionId: string) => {
    deleteMutation.mutate(connectionId)
  }

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
    <>
      <SectionHeader
        title="Connections"
        description="Connect external SaaS tools so your agents can take real actions across apps."
      />

      <div className="relative">
        <IconSearch
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search apps (GitHub, Slack, Drive...)"
          className="h-9 w-full rounded-md border border-input bg-transparent pr-3 pl-8 text-xs shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>

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
              const activeConnection = connections.find(
                (connection) =>
                  connection.externalAccountId === integration.accountId ||
                  connection.provider === integration.id ||
                  connection.externalAccountId
                    .toLowerCase()
                    .includes(integration.id)
              )

              const isConnected = Boolean(activeConnection)
              const isConnecting =
                connectMutation.isPending &&
                connectMutation.variables?.appName === integration.id
              const isWaitingForAuth =
                pendingAuthApp === integration.id && !isConnected
              const isDisconnecting =
                deleteMutation.isPending &&
                deleteMutation.variables === activeConnection?.id

              return (
                <IntegrationRow
                  key={integration.id}
                  integration={integration}
                  activeConnection={activeConnection}
                  isConnected={isConnected}
                  isConnecting={isConnecting}
                  isWaitingForAuth={isWaitingForAuth}
                  isDisconnecting={isDisconnecting}
                  onConnect={() => handleConnect(integration.id)}
                  onDisconnect={() =>
                    activeConnection && handleDisconnect(activeConnection.id)
                  }
                />
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
