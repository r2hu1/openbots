"use client";

import { Button } from "@openbots/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@openbots/ui/components/sheet";
import { Spinner } from "@openbots/ui/components/spinner";
import { IconSearch } from "@tabler/icons-react";
import * as React from "react";
import { AVAILABLE_INTEGRATIONS } from "../constants";
import {
  useConnectionsQuery,
  useDeleteConnectionMutation,
  useInitiateConnectionMutation,
} from "../queries";
import { IntegrationRow } from "./integration-row";

interface ConnectionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000;

const SCROLL_CLASS =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain " +
  "[scrollbar-gutter:stable] [scrollbar-width:thin]";

export function ConnectionsSheet({
  open,
  onOpenChange,
}: ConnectionsSheetProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [pollingEnabled, setPollingEnabled] = React.useState(false);

  const baselineCount = React.useRef(0);
  const pollTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: connections = [], isLoading } = useConnectionsQuery({
    enabled: open,
    refetchInterval: pollingEnabled ? POLL_INTERVAL_MS : false,
  });

  const connectMutation = useInitiateConnectionMutation();
  const deleteMutation = useDeleteConnectionMutation();

  React.useEffect(() => {
    if (pollingEnabled && connections.length > baselineCount.current) {
      setPollingEnabled(false);
      if (pollTimeout.current) {
        clearTimeout(pollTimeout.current);
        pollTimeout.current = null;
      }
    }
  }, [connections.length, pollingEnabled]);

  React.useEffect(() => {
    return () => {
      if (pollTimeout.current) {
        clearTimeout(pollTimeout.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setPollingEnabled(false);
      if (pollTimeout.current) {
        clearTimeout(pollTimeout.current);
        pollTimeout.current = null;
      }
    }
  }, [open]);

  const handleConnect = (appName: string) => {
    connectMutation.mutate(
      { appName },
      {
        onSuccess: (data) => {
          if (!data.redirectUrl) return;
          baselineCount.current = connections.length;
          window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
          setPollingEnabled(true);

          if (pollTimeout.current) {
            clearTimeout(pollTimeout.current);
          }

          pollTimeout.current = setTimeout(() => {
            setPollingEnabled(false);
            pollTimeout.current = null;
          }, POLL_TIMEOUT_MS);
        },
      },
    );
  };

  const handleDisconnect = (connectionId: string) => {
    deleteMutation.mutate(connectionId);
  };

  const filteredIntegrations = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return AVAILABLE_INTEGRATIONS;
    }
    return AVAILABLE_INTEGRATIONS.filter((integration) => {
      return (
        integration.name.toLowerCase().includes(query) ||
        integration.description.toLowerCase().includes(query) ||
        integration.id.toLowerCase().includes(query)
      );
    });
  }, [searchQuery]);

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

        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden px-4 pb-6">
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
              onChange={(e) => setSearchQuery(e.target.value)}
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
                    const activeConnection = connections.find(
                      (connection) =>
                        connection.externalAccountId ===
                          integration.accountId ||
                        connection.provider === integration.id ||
                        connection.externalAccountId
                          .toLowerCase()
                          .includes(integration.id),
                    );

                    const isConnected = Boolean(activeConnection);
                    const isConnecting =
                      connectMutation.isPending &&
                      connectMutation.variables?.appName === integration.id;
                    const isWaitingForAuth =
                      pollingEnabled && !isConnected && isConnecting;
                    const isDisconnecting =
                      deleteMutation.isPending &&
                      deleteMutation.variables === activeConnection?.id;

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
                          activeConnection &&
                          handleDisconnect(activeConnection.id)
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
