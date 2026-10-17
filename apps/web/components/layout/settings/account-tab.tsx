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
import { Avatar, AvatarFallback } from "@openbots/ui/components/avatar"
import { Badge } from "@openbots/ui/components/badge"
import { Button } from "@openbots/ui/components/button"
import { Field, FieldGroup, FieldLabel } from "@openbots/ui/components/field"
import { Input } from "@openbots/ui/components/input"
import { Spinner } from "@openbots/ui/components/spinner"
import * as React from "react"
import { Logout as IconLogout } from "reicon-react"
import { authClient, signOut, useSession } from "@/lib/auth-client"
import {
  DESTRUCTIVE_ACTION_CLASS,
  Feedback,
  GroupLabel,
  Panel,
  SectionHeader,
  SettingRow,
  StatusMessage,
  useAutoClear,
} from "./settings-shared"

function getInitials(name?: string | null) {
  return (
    (name || "U")
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U"
  )
}

export function AccountTab({ onClose }: { onClose: () => void }) {
  const { data: session, refetch } = useSession()
  const [name, setName] = React.useState(session?.user?.name ?? "")
  const [saving, setSaving] = React.useState(false)
  const [feedback, setFeedback] = React.useState<Feedback | null>(null)
  const [confirmText, setConfirmText] = React.useState("")
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    setName(session?.user?.name ?? "")
  }, [session?.user?.name])

  const clearFeedback = React.useCallback(() => setFeedback(null), [])
  useAutoClear(feedback, clearFeedback, 2500)

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setFeedback(null)
    try {
      const res = await authClient.updateUser({ name: name.trim() })
      if (res?.error) {
        setFeedback({
          type: "error",
          message: res.error.message || "Failed to update profile.",
        })
      } else {
        setFeedback({ type: "success", message: "Profile updated." })
        await refetch()
      }
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message: (err as Error)?.message || "Failed to update profile.",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    onClose()
    await signOut()
    window.location.href = "/login"
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      await authClient.deleteUser()
      onClose()
      await signOut()
      window.location.href = "/login"
    } catch (err) {
      console.error("Failed to delete account:", err)
    } finally {
      setDeleting(false)
    }
  }

  const unchanged = name.trim() === (session?.user?.name ?? "")

  return (
    <>
      <SectionHeader
        title="Account"
        description="Your profile and sign-in details."
      />

      <div className="flex items-center gap-4 rounded-xl border border-border p-4">
        <Avatar className="size-12 shrink-0">
          <AvatarFallback className="bg-muted text-sm font-semibold">
            {getInitials(name || session?.user?.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">
              {session?.user?.name || "User"}
            </p>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {session?.user?.emailVerified ? "Verified" : "Active"}
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {session?.user?.email || "user@example.com"}
          </p>
        </div>
      </div>

      <form onSubmit={handleUpdateProfile} className="space-y-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="account-name">Full name</FieldLabel>
            <Input
              id="account-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="account-email">Email address</FieldLabel>
            <Input
              id="account-email"
              type="email"
              value={session?.user?.email || ""}
              disabled
              readOnly
              className="cursor-not-allowed bg-muted/40 opacity-70"
            />
            <p className="text-xs text-muted-foreground">
              Email changes are verified by your authentication provider.
            </p>
          </Field>
        </FieldGroup>

        {feedback && (
          <StatusMessage type={feedback.type}>{feedback.message}</StatusMessage>
        )}

        <Button type="submit" size="sm" disabled={saving || unchanged}>
          {saving && <Spinner data-icon="inline-start" />}
          {saving ? "Saving..." : "Save profile"}
        </Button>
      </form>

      <div>
        <GroupLabel>Session</GroupLabel>
        <Panel>
          <SettingRow
            title="Sign out"
            description="Sign out of OpenBots on this device."
          >
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <IconLogout />
              Sign out
            </Button>
          </SettingRow>
        </Panel>
      </div>

      <div>
        <GroupLabel className="text-destructive">Danger zone</GroupLabel>
        <div className="rounded-xl border border-destructive/30">
          <SettingRow
            title="Delete account"
            description="Permanently remove your account, agents, and data."
          >
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant="destructive" size="sm">
                    Delete
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete account</AlertDialogTitle>
                  <AlertDialogDescription>
                    This cannot be undone. All your agents, conversations, and
                    keys will be permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-foreground">
                    Type <span className="font-mono">DELETE</span> to confirm
                  </p>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DELETE"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setConfirmText("")}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={confirmText !== "DELETE" || deleting}
                    className={DESTRUCTIVE_ACTION_CLASS}
                  >
                    {deleting ? "Deleting..." : "Permanently delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </SettingRow>
        </div>
      </div>
    </>
  )
}
