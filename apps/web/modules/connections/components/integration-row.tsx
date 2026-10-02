"use client";

import { Button } from "@openbots/ui/components/button";
import { Spinner } from "@openbots/ui/components/spinner";
import { IconPlus } from "@tabler/icons-react";
import type { Connection, IntegrationApp } from "../types";

interface IntegrationRowProps {
  integration: IntegrationApp;
  activeConnection?: Connection;
  isConnected: boolean;
  isConnecting: boolean;
  isWaitingForAuth: boolean;
  isDisconnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function IntegrationRow({
  integration,
  isConnected,
  isConnecting,
  isWaitingForAuth,
  isDisconnecting,
  onConnect,
  onDisconnect,
}: IntegrationRowProps) {
  const Icon = integration.icon;
  const isPending = isConnecting || isWaitingForAuth || isDisconnecting;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
        <Icon className="size-4.5" />
      </div>

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

      {isConnected ? (
        <Button
          type="button"
          size="xs"
          variant="outline"
          className="shrink-0 gap-1 text-[11px]"
          disabled={isPending}
          onClick={onDisconnect}
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
          onClick={onConnect}
        >
          {isConnecting || isWaitingForAuth ? (
            <Spinner className="size-3!" />
          ) : (
            <IconPlus className="size-3" />
          )}
          {isWaitingForAuth ? "Waiting" : "Connect"}
        </Button>
      )}
    </div>
  );
}
