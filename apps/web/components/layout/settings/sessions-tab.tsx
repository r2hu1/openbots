"use client"

import { Badge } from "@openbots/ui/components/badge"
import { Button } from "@openbots/ui/components/button"
import { Spinner } from "@openbots/ui/components/spinner"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import {
  Devices as IconDeviceLaptop,
  Mobile as IconDeviceMobile,
  Devices as IconDevices,
  Logout as IconLogout,
} from "reicon-react"
import { authClient, useSession } from "@/lib/auth-client"
import { Panel, SectionHeader } from "./settings-shared"

interface ActiveSessionItem {
  id: string
  token?: string
  createdAt: string | Date
  expiresAt: string | Date
  userAgent?: string | null
  ipAddress?: string | null
}

const NO_SESSIONS: ActiveSessionItem[] = []

function describeDevice(ua?: string | null) {
  if (!ua) return { label: "Web session", mobile: false }
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser"
  const os = /iPhone|iPad|iOS/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : null
  return {
    label: os ? `${browser} on ${os}` : browser,
    mobile: /iPhone|Android|Mobile/.test(ua),
  }
}

export function SessionsTab() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()

  const { data, isLoading } = useQuery({
    queryKey: ["auth-sessions"],
    queryFn: async () => {
      const res = await authClient.listSessions()
      return Array.isArray(res?.data)
        ? (res.data as ActiveSessionItem[])
        : NO_SESSIONS
    },
  })

  const sessions = data ?? NO_SESSIONS
  const currentId = (session as { session?: { id?: string } } | null)?.session
    ?.id

  const revokeMutation = useMutation({
    mutationFn: async (token: string) => {
      await authClient.revokeSession({ token })
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["auth-sessions"] }),
  })

  const revokeOthersMutation = useMutation({
    mutationFn: async () => {
      await authClient.revokeOtherSessions()
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["auth-sessions"] }),
  })

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <SectionHeader
          title="Sessions"
          description="Devices currently signed in to your account."
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => revokeOthersMutation.mutate()}
          disabled={revokeOthersMutation.isPending || sessions.length <= 1}
          className="shrink-0"
        >
          {revokeOthersMutation.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <IconLogout />
          )}
          Sign out others
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-5" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          <IconDevices className="mx-auto mb-2 size-7 opacity-40" />
          Only this session is active.
        </div>
      ) : (
        <Panel>
          {sessions.map((s, idx) => {
            const isCurrent = currentId ? currentId === s.id : idx === 0
            const device = describeDevice(s.userAgent)
            const DeviceIcon = device.mobile
              ? IconDeviceMobile
              : IconDeviceLaptop
            const revokeKey = s.token ?? s.id
            const revoking =
              revokeMutation.isPending &&
              revokeMutation.variables === revokeKey

            return (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <DeviceIcon className="size-4.5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {device.label}
                    </span>
                    {isCurrent && (
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-[10px]"
                      >
                        This device
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.ipAddress ? `${s.ipAddress} · ` : ""}
                    Signed in {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {!isCurrent && (
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={revoking}
                    onClick={() => revokeMutation.mutate(revokeKey)}
                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    {revoking && <Spinner className="size-3" />}
                    Revoke
                  </Button>
                )}
              </div>
            )
          })}
        </Panel>
      )}
    </>
  )
}
