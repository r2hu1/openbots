"use client"

import { Button } from "@openbots/ui/components/button"
import { Field, FieldGroup, FieldLabel } from "@openbots/ui/components/field"
import { Input } from "@openbots/ui/components/input"
import { Spinner } from "@openbots/ui/components/spinner"
import { Switch } from "@openbots/ui/components/switch"
import * as React from "react"
import { Lock as IconLock } from "reicon-react"
import { authClient } from "@/lib/auth-client"
import {
  Feedback,
  Panel,
  SectionHeader,
  SettingRow,
  StatusMessage,
  useAutoClear,
} from "./settings-shared"

export function SecurityTab() {
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [revokeOthers, setRevokeOthers] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [feedback, setFeedback] = React.useState<Feedback | null>(null)

  const clearFeedback = React.useCallback(() => setFeedback(null), [])
  useAutoClear(feedback, clearFeedback)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword !== confirmPassword) {
      setFeedback({ type: "error", message: "New passwords do not match." })
      return
    }
    if (newPassword.length < 8) {
      setFeedback({
        type: "error",
        message: "Password must be at least 8 characters long.",
      })
      return
    }

    setSaving(true)
    setFeedback(null)
    try {
      const res = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: revokeOthers,
      })
      if (res?.error) {
        setFeedback({
          type: "error",
          message: res.error.message || "Failed to change password.",
        })
      } else {
        setFeedback({ type: "success", message: "Password changed." })
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      }
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message: (err as Error)?.message || "Failed to change password.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SectionHeader
        title="Security"
        description="Update your password and control other signed-in devices."
      />

      <form onSubmit={handleChangePassword} className="space-y-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="current-pwd">Current password</FieldLabel>
            <Input
              id="current-pwd"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="new-pwd">New password</FieldLabel>
            <Input
              id="new-pwd"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="confirm-pwd">Confirm new password</FieldLabel>
            <Input
              id="confirm-pwd"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
        </FieldGroup>

        <Panel>
          <SettingRow
            title="Sign out of other devices"
            description="Revoke all other sessions when the password changes."
          >
            <Switch checked={revokeOthers} onCheckedChange={setRevokeOthers} />
          </SettingRow>
        </Panel>

        {feedback && (
          <StatusMessage type={feedback.type}>{feedback.message}</StatusMessage>
        )}

        <Button
          type="submit"
          size="sm"
          disabled={
            saving || !currentPassword || !newPassword || !confirmPassword
          }
        >
          {saving ? <Spinner data-icon="inline-start" /> : <IconLock />}
          {saving ? "Updating..." : "Change password"}
        </Button>
      </form>
    </>
  )
}
