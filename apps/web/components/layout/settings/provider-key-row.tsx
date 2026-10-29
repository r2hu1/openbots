"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@openbots/ui/components/alert-dialog"
import { Button } from "@openbots/ui/components/button"
import { Input } from "@openbots/ui/components/input"
import { Spinner } from "@openbots/ui/components/spinner"
import * as React from "react"
import {
  Link2 as IconExternalLink,
  Eye as IconEye,
  EyeOff as IconEyeOff,
  Key as IconKey,
  Trash2 as IconTrash,
} from "reicon-react"
import type { ConfiguredKeyInfo, ProviderKeyMeta } from "./api-keys-constants"
import { Feedback, StatusMessage, useAutoClear } from "./settings-shared"

export function ProviderKeyRow({
  meta,
  configured,
  onChanged,
}: {
  meta: ProviderKeyMeta
  configured?: ConfiguredKeyInfo
  onChanged: () => void
}) {
  const [value, setValue] = React.useState("")
  const [revealed, setRevealed] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [feedback, setFeedback] = React.useState<Feedback | null>(null)

  const clearFeedback = React.useCallback(() => setFeedback(null), [])
  useAutoClear(feedback, clearFeedback)

  const handleSave = async () => {
    const apiKey = value.trim()
    if (!apiKey) return
    setSaving(true)
    setFeedback(null)
    try {
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
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        credentials: "include",
        body: JSON.stringify({ provider: meta.provider, apiKey }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setFeedback({
          type: "error",
          message: data.error || "Failed to save API key.",
        })
      } else {
        setFeedback({ type: "success", message: "Key encrypted and saved." })
        setValue("")
        onChanged()
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message: (err as Error)?.message || "Error saving API key.",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const apiBaseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
      const headers: Record<string, string> = {}
      if (typeof window !== "undefined") {
        const token =
          localStorage.getItem("bearer_token") ||
          localStorage.getItem("better-auth_token")
        if (token) headers.Authorization = `Bearer ${token}`
      }

      const res = await fetch(`${apiBaseUrl}/api/api-keys/${meta.provider}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      })
      if (res.ok) {
        setFeedback({ type: "success", message: "Key removed." })
        onChanged()
      } else {
        setFeedback({ type: "error", message: "Failed to remove key." })
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message: (err as Error)?.message || "Failed to remove key.",
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {meta.name}
            </span>
            {configured ? (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Configured
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                Not configured
              </span>
            )}
          </div>
        </div>

        <a
          href={meta.docsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Get key
          <IconExternalLink className="size-3" />
        </a>
      </div>

      {configured && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 py-1.5 pr-1.5 pl-3">
          <div className="flex min-w-0 items-center gap-2">
            <IconKey className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-mono text-xs text-muted-foreground">
              {configured.keyHint
                ? `••••${configured.keyHint}`
                : "Key configured and encrypted"}
            </span>
          </div>

          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-xs"
                  disabled={deleting}
                >
                  {deleting ? <Spinner className="size-3" /> : <IconTrash />}
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove {meta.name} key?</AlertDialogTitle>
                <AlertDialogDescription>
                  Agents will stop using your {meta.name} key. You can add it
                  back anytime.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} variant="destructive">
                  Remove key
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            type={revealed ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              configured ? "Enter a new key to replace it" : meta.placeholder
            }
            autoComplete="off"
            className="pr-9 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Hide key" : "Show key"}
            className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            {revealed ? (
              <IconEyeOff className="size-4" />
            ) : (
              <IconEye className="size-4" />
            )}
          </button>
        </div>

        <Button
          type="button"
          disabled={saving || !value.trim()}
          onClick={handleSave}
          className="shrink-0"
        >
          {saving && <Spinner data-icon="inline-start" />}
          {configured ? "Update" : "Save"}
        </Button>
      </div>

      {feedback && (
        <StatusMessage type={feedback.type}>{feedback.message}</StatusMessage>
      )}
    </div>
  )
}
