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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@openbots/ui/components/sheet"
import { Spinner } from "@openbots/ui/components/spinner"
import { Switch } from "@openbots/ui/components/switch"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openbots/ui/components/tabs"
import {
  IconAlertTriangle,
  IconCheck,
  IconDeviceLaptop,
  IconDevices,
  IconKey,
  IconLock,
  IconLogout,
  IconMoon,
  IconShield,
  IconSun,
  IconTrash,
  IconUser,
} from "@tabler/icons-react"
import { useTheme } from "next-themes"
import * as React from "react"
import { authClient, signOut, useSession } from "@/lib/auth-client"

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ActiveSessionItem {
  id: string
  createdAt: string | Date
  expiresAt: string | Date
  userAgent?: string | null
  ipAddress?: string | null
}

const SCROLL_CLASS =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain " +
  "[scrollbar-gutter:stable] [scrollbar-width:thin] " +
  "[scrollbar-color:color-mix(in_oklab,currentColor_25%,transparent)_transparent]"

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  const { data: session, refetch: refetchSession } = useSession()
  const { theme, setTheme } = useTheme()

  const [activeTab, setActiveTab] = React.useState<
    "general" | "account" | "security" | "sessions"
  >("general")

  // Profile state
  const [name, setName] = React.useState("")
  const [isUpdatingUser, setIsUpdatingUser] = React.useState(false)
  const [userUpdateSuccess, setUserUpdateSuccess] = React.useState(false)
  const [userUpdateError, setUserUpdateError] = React.useState<string | null>(
    null
  )

  // Password state
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [revokeOtherSessions, setRevokeOtherSessions] = React.useState(true)
  const [isChangingPassword, setIsChangingPassword] = React.useState(false)
  const [passwordSuccess, setPasswordSuccess] = React.useState(false)
  const [passwordError, setPasswordError] = React.useState<string | null>(null)

  // Sessions state
  const [activeSessions, setActiveSessions] = React.useState<
    ActiveSessionItem[]
  >([])
  const [isLoadingSessions, setIsLoadingSessions] = React.useState(false)
  const [revokingSessionId, setRevokingSessionId] = React.useState<
    string | null
  >(null)
  const [revokingOtherSessions, setRevokingOtherSessions] =
    React.useState(false)

  // Account deletion
  const [deleteConfirmation, setDeleteConfirmation] = React.useState("")
  const [isDeletingAccount, setIsDeletingAccount] = React.useState(false)

  // General chat workspace preferences
  const [soundEnabled, setSoundEnabled] = React.useState(true)
  const [autoScrollEnabled, setAutoScrollEnabled] = React.useState(true)

  // Initialize form state
  React.useEffect(() => {
    if (open && session?.user) {
      setName(session.user.name || "")
      setUserUpdateSuccess(false)
      setUserUpdateError(null)
      setPasswordSuccess(false)
      setPasswordError(null)
    }
  }, [open, session])

  // Fetch active sessions when the sessions tab is opened
  const fetchSessions = React.useCallback(async () => {
    setIsLoadingSessions(true)
    try {
      const res = await authClient.listSessions()
      if (res?.data && Array.isArray(res.data)) {
        setActiveSessions(res.data as ActiveSessionItem[])
      } else {
        setActiveSessions([])
      }
    } catch (err) {
      console.error("Failed to load sessions:", err)
    } finally {
      setIsLoadingSessions(false)
    }
  }, [])

  React.useEffect(() => {
    if (open && activeTab === "sessions") {
      fetchSessions()
    }
  }, [open, activeTab, fetchSessions])

  const userInitials = React.useMemo(() => {
    const raw = name || session?.user?.name || "U"
    return raw
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }, [name, session?.user?.name])

  // Update Profile Name via Better Auth
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsUpdatingUser(true)
    setUserUpdateError(null)
    setUserUpdateSuccess(false)

    try {
      const res = await authClient.updateUser({
        name: name.trim(),
      })
      if (res?.error) {
        setUserUpdateError(res.error.message || "Failed to update profile.")
      } else {
        setUserUpdateSuccess(true)
        await refetchSession()
        setTimeout(() => setUserUpdateSuccess(false), 2500)
      }
    } catch (err: unknown) {
      setUserUpdateError((err as Error)?.message || "Failed to update profile.")
    } finally {
      setIsUpdatingUser(false)
    }
  }

  // Change Password via Better Auth
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.")
      return
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long.")
      return
    }

    setIsChangingPassword(true)
    setPasswordError(null)
    setPasswordSuccess(false)

    try {
      const res = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions,
      })
      if (res?.error) {
        setPasswordError(res.error.message || "Failed to change password.")
      } else {
        setPasswordSuccess(true)
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        setTimeout(() => setPasswordSuccess(false), 3000)
      }
    } catch (err: unknown) {
      setPasswordError((err as Error)?.message || "Failed to change password.")
    } finally {
      setIsChangingPassword(false)
    }
  }

  // Revoke Specific Session
  const handleRevokeSession = async (tokenOrId: string) => {
    setRevokingSessionId(tokenOrId)
    try {
      await authClient.revokeSession({ token: tokenOrId })
      await fetchSessions()
    } catch (err) {
      console.error("Failed to revoke session:", err)
    } finally {
      setRevokingSessionId(null)
    }
  }

  // Revoke All Other Sessions
  const handleRevokeOtherSessions = async () => {
    setRevokingOtherSessions(true)
    try {
      await authClient.revokeOtherSessions()
      await fetchSessions()
    } catch (err) {
      console.error("Failed to revoke other sessions:", err)
    } finally {
      setRevokingOtherSessions(false)
    }
  }

  // Delete User Account
  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true)
    try {
      await authClient.deleteUser()
      onOpenChange(false)
      await signOut()
      window.location.href = "/login"
    } catch (err) {
      console.error("Failed to delete account:", err)
    } finally {
      setIsDeletingAccount(false)
    }
  }

  const handleSignOut = async () => {
    onOpenChange(false)
    await signOut()
    window.location.href = "/login"
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:min-w-2xl!"
      >
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Manage your profile, preferences, and account security.
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val) =>
            setActiveTab(val as "general" | "account" | "security" | "sessions")
          }
          className="flex min-h-0 flex-1 flex-col pb-6"
        >
          <div className="border-b border-border/60 px-6 pt-3 pb-2">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general" className="text-xs">
                General
              </TabsTrigger>
              <TabsTrigger value="account" className="text-xs">
                Account
              </TabsTrigger>
              <TabsTrigger value="security" className="text-xs">
                Security
              </TabsTrigger>
              <TabsTrigger value="sessions" className="text-xs">
                Sessions
              </TabsTrigger>
            </TabsList>
          </div>

          <div className={SCROLL_CLASS}>
            {/* 1. GENERAL TAB */}
            <TabsContent value="general" className="m-0 space-y-6 p-6">
              <div className="space-y-3">
                <FieldLabel className="text-sm font-medium">
                  Appearance
                </FieldLabel>
                <p className="text-xs text-muted-foreground">
                  Select how OpenBots looks to you.
                </p>
                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all ${
                      theme === "light"
                        ? "border-primary bg-primary/5 text-primary shadow-xs"
                        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <IconSun className="size-5" />
                    <span>Light</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all ${
                      theme === "dark"
                        ? "border-primary bg-primary/5 text-primary shadow-xs"
                        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <IconMoon className="size-5" />
                    <span>Dark</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme("system")}
                    className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all ${
                      theme === "system"
                        ? "border-primary bg-primary/5 text-primary shadow-xs"
                        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <IconDeviceLaptop className="size-5" />
                    <span>System</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <FieldLabel className="text-sm font-medium">
                  Chat & Workspace
                </FieldLabel>
                <div className="space-y-3 rounded-xl border border-border/80 bg-sidebar/30 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-foreground">
                        Auto-scroll messages
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Automatically follow conversation output as new tokens
                        arrive.
                      </p>
                    </div>
                    <Switch
                      checked={autoScrollEnabled}
                      onCheckedChange={setAutoScrollEnabled}
                    />
                  </div>

                  <div className="h-px bg-border/40" />

                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-foreground">
                        Audio cues
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Play sound notifications when agent runs complete or
                        require attention.
                      </p>
                    </div>
                    <Switch
                      checked={soundEnabled}
                      onCheckedChange={setSoundEnabled}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* 2. ACCOUNT TAB */}
            <TabsContent value="account" className="m-0 space-y-6 p-6">
              <div className="flex items-center gap-3.5 rounded-xl border border-border/80 bg-sidebar/40 p-4">
                <Avatar className="size-12 shrink-0">
                  <AvatarFallback className="bg-sidebar-accent text-sm font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {session?.user?.name || "User"}
                    </p>
                    <Badge
                      variant="secondary"
                      className="h-4 px-1.5 text-[10px]"
                    >
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
                    <FieldLabel
                      htmlFor="account-name"
                      className="text-xs font-medium"
                    >
                      Full Name
                    </FieldLabel>
                    <Input
                      id="account-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="mt-1"
                    />
                  </Field>

                  <Field>
                    <FieldLabel
                      htmlFor="account-email"
                      className="text-xs font-medium"
                    >
                      Email Address
                    </FieldLabel>
                    <Input
                      id="account-email"
                      type="email"
                      value={session?.user?.email || ""}
                      disabled
                      readOnly
                      placeholder="user@example.com"
                      className="mt-1 cursor-not-allowed bg-muted/40 opacity-70"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Email updates are verified via your authentication
                      provider.
                    </p>
                  </Field>
                </FieldGroup>

                {userUpdateError && (
                  <p className="text-xs text-destructive">{userUpdateError}</p>
                )}

                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      isUpdatingUser || name.trim() === session?.user?.name
                    }
                    className="gap-1.5"
                  >
                    {isUpdatingUser ? (
                      <>
                        <Spinner className="size-3.5" />
                        <span>Updating...</span>
                      </>
                    ) : userUpdateSuccess ? (
                      <>
                        <IconCheck className="size-3.5 text-emerald-500" />
                        <span>Updated</span>
                      </>
                    ) : (
                      <span>Save profile</span>
                    )}
                  </Button>
                </div>
              </form>

              {/* Danger Zone */}
              <div className="space-y-3 border-t border-border/60 pt-4">
                <FieldLabel className="text-xs font-medium text-destructive">
                  Danger Zone
                </FieldLabel>

                <div className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 p-3.5">
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-destructive">
                      Delete Account
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Permanently remove your account, agents, and data.
                    </p>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          variant="destructive"
                          size="xs"
                          className="h-7 px-2.5 text-xs"
                        >
                          Delete
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Account</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. All your agents,
                          conversations, and keys will be permanently deleted.
                          <div className="mt-3">
                            <span className="text-xs font-medium text-foreground">
                              Type <strong className="font-mono">DELETE</strong>{" "}
                              to confirm:
                            </span>
                            <Input
                              value={deleteConfirmation}
                              onChange={(e) =>
                                setDeleteConfirmation(e.target.value)
                              }
                              placeholder="DELETE"
                              className="mt-1"
                            />
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel
                          onClick={() => setDeleteConfirmation("")}
                        >
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAccount}
                          disabled={
                            deleteConfirmation !== "DELETE" || isDeletingAccount
                          }
                          className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
                        >
                          {isDeletingAccount
                            ? "Deleting..."
                            : "Permanently Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </TabsContent>

            {/* 3. SECURITY TAB */}
            <TabsContent value="security" className="m-0 space-y-6 p-6">
              <div className="space-y-1">
                <FieldLabel className="text-sm font-medium">
                  Password & Authentication
                </FieldLabel>
                <p className="text-xs text-muted-foreground">
                  Update your credentials and manage active session
                  authentication.
                </p>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel
                      htmlFor="current-pwd"
                      className="text-xs font-medium"
                    >
                      Current Password
                    </FieldLabel>
                    <Input
                      id="current-pwd"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="mt-1"
                      required
                    />
                  </Field>

                  <Field>
                    <FieldLabel
                      htmlFor="new-pwd"
                      className="text-xs font-medium"
                    >
                      New Password
                    </FieldLabel>
                    <Input
                      id="new-pwd"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="mt-1"
                      required
                    />
                  </Field>

                  <Field>
                    <FieldLabel
                      htmlFor="confirm-pwd"
                      className="text-xs font-medium"
                    >
                      Confirm New Password
                    </FieldLabel>
                    <Input
                      id="confirm-pwd"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="mt-1"
                      required
                    />
                  </Field>
                </FieldGroup>

                <div className="flex items-center justify-between rounded-lg border border-border/80 bg-sidebar/30 p-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-foreground">
                      Sign out of other devices
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Revoke all other active sessions upon password change.
                    </p>
                  </div>
                  <Switch
                    checked={revokeOtherSessions}
                    onCheckedChange={setRevokeOtherSessions}
                  />
                </div>

                {passwordError && (
                  <p className="text-xs text-destructive">{passwordError}</p>
                )}

                <div className="pt-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      isChangingPassword ||
                      !currentPassword ||
                      !newPassword ||
                      !confirmPassword
                    }
                    className="gap-1.5"
                  >
                    {isChangingPassword ? (
                      <>
                        <Spinner className="size-3.5" />
                        <span>Updating Password...</span>
                      </>
                    ) : passwordSuccess ? (
                      <>
                        <IconCheck className="size-3.5 text-emerald-500" />
                        <span>Password Changed</span>
                      </>
                    ) : (
                      <>
                        <IconLock className="size-3.5" />
                        <span>Change Password</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* 4. SESSIONS TAB */}
            <TabsContent value="sessions" className="m-0 space-y-6 p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <FieldLabel className="text-sm font-medium">
                    Active Devices
                  </FieldLabel>
                  <p className="text-xs text-muted-foreground">
                    Devices and sessions currently logged into your account.
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="xs"
                  onClick={handleRevokeOtherSessions}
                  disabled={revokingOtherSessions || activeSessions.length <= 1}
                  className="h-7 gap-1 text-xs"
                >
                  {revokingOtherSessions ? (
                    <Spinner className="size-3" />
                  ) : (
                    <IconLogout className="size-3" />
                  )}
                  <span>Sign out others</span>
                </Button>
              </div>

              {isLoadingSessions ? (
                <div className="flex justify-center py-12">
                  <Spinner className="size-5" />
                </div>
              ) : activeSessions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground">
                  <IconDevices className="mx-auto mb-2 size-8 opacity-40" />
                  <p>Current session active.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeSessions.map((s, idx) => {
                    const isCurrent =
                      (session as { session?: { id?: string } })?.session
                        ?.id === s.id || idx === 0

                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-xl border border-border/80 bg-sidebar/30 p-3 text-xs"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="max-w-45 truncate font-medium text-foreground">
                              {s.userAgent
                                ? s.userAgent.slice(0, 30) +
                                  (s.userAgent.length > 30 ? "..." : "")
                                : "Active Web Session"}
                            </span>
                            {isCurrent && (
                              <Badge
                                variant="secondary"
                                className="h-4 px-1 text-[9px]"
                              >
                                This device
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {s.ipAddress ? `IP: ${s.ipAddress} • ` : ""}
                            Created {new Date(s.createdAt).toLocaleDateString()}
                          </p>
                        </div>

                        {!isCurrent && (
                          <Button
                            variant="ghost"
                            size="xs"
                            disabled={revokingSessionId === s.id}
                            onClick={() => handleRevokeSession(s.id)}
                            className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            {revokingSessionId === s.id ? (
                              <Spinner className="size-3" />
                            ) : (
                              "Revoke"
                            )}
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
