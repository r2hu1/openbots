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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTheme } from "next-themes"
import * as React from "react"
import {
  Check as IconCheck,
  Devices as IconDeviceLaptop,
  Mobile as IconDeviceMobile,
  Devices as IconDevices,
  Link2 as IconExternalLink,
  Eye as IconEye,
  EyeOff as IconEyeOff,
  Key as IconKey,
  Lock as IconLock,
  Logout as IconLogout,
  Moon as IconMoon,
  Settings as IconSettings,
  Shield as IconShield,
  Sun as IconSun,
  Trash as IconTrash,
  User as IconUser,
} from "reicon-react"
import { authClient, signOut, useSession } from "@/lib/auth-client"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { cn } from "@/lib/utils"

export type SupportedLlmProvider =
  "openai" | "anthropic" | "openrouter" | "google" | "groq" | "xai" | "deepseek"

export interface ProviderKeyMeta {
  provider: SupportedLlmProvider
  name: string
  description: string
  docsUrl: string
  placeholder: string
  envFallbackName: string
}

export const LLM_PROVIDERS: ProviderKeyMeta[] = [
  {
    provider: "openai",
    name: "OpenAI",
    description: "GPT-4o, GPT-4.5, o1, o3-mini and embeddings models.",
    docsUrl: "https://platform.openai.com/api-keys",
    placeholder: "sk-proj-...",
    envFallbackName: "OPENAI_API_KEY",
  },
  {
    provider: "anthropic",
    name: "Anthropic",
    description: "Claude 3.7 Sonnet, Claude 3.5 Haiku, and Claude 3 Opus.",
    docsUrl: "https://console.anthropic.com/settings/keys",
    placeholder: "sk-ant-...",
    envFallbackName: "ANTHROPIC_API_KEY",
  },
  {
    provider: "openrouter",
    name: "OpenRouter",
    description: "Unified API for 200+ models with competitive routing.",
    docsUrl: "https://openrouter.ai/settings/keys",
    placeholder: "sk-or-v1-...",
    envFallbackName: "OPENROUTER_API_KEY",
  },
  {
    provider: "google",
    name: "Google AI (Gemini)",
    description: "Gemini 2.5 Pro, Flash, Flash-Lite, and 1.5 models.",
    docsUrl: "https://aistudio.google.com/app/apikey",
    placeholder: "AIzaSy...",
    envFallbackName: "GEMINI_API_KEY",
  },
  {
    provider: "groq",
    name: "Groq",
    description:
      "Ultra-fast LPU inference for Llama 3.3, DeepSeek, and Mixtral.",
    docsUrl: "https://console.groq.com/keys",
    placeholder: "gsk_...",
    envFallbackName: "GROQ_API_KEY",
  },
  {
    provider: "xai",
    name: "Grok (xAI)",
    description: "Grok 2 and Grok Beta models with live knowledge.",
    docsUrl: "https://console.x.ai/",
    placeholder: "xai-...",
    envFallbackName: "XAI_API_KEY",
  },
  {
    provider: "deepseek",
    name: "DeepSeek",
    description: "DeepSeek-V3 and DeepSeek-R1 reasoning models.",
    docsUrl: "https://platform.deepseek.com/api_keys",
    placeholder: "sk-...",
    envFallbackName: "DEEPSEEK_API_KEY",
  },
]

interface ConfiguredKeyInfo {
  provider: SupportedLlmProvider
  keyHint?: string
  updatedAt?: string | Date
}

interface ActiveSessionItem {
  id: string
  token?: string
  createdAt: string | Date
  expiresAt: string | Date
  userAgent?: string | null
  ipAddress?: string | null
}

type SettingsTab = "general" | "account" | "keys" | "security" | "sessions"

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Feedback = { type: "success" | "error"; message: string }

const NO_KEYS: Record<string, ConfiguredKeyInfo> = {}
const NO_SESSIONS: ActiveSessionItem[] = []

const NAV_ITEMS: Array<{
  id: SettingsTab
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: "general", label: "General", icon: IconSettings },
  { id: "account", label: "Account", icon: IconUser },
  { id: "keys", label: "API keys", icon: IconKey },
  { id: "security", label: "Security", icon: IconShield },
  { id: "sessions", label: "Sessions", icon: IconDevices },
]

const SCROLL_CLASS =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain " +
  "[scrollbar-gutter:stable] [scrollbar-width:thin] " +
  "[scrollbar-color:color-mix(in_oklab,currentColor_25%,transparent)_transparent]"

const DESTRUCTIVE_ACTION_CLASS =
  "text-destructive-foreground bg-destructive hover:bg-destructive/90"

function useStoredBoolean(key: string, initial: boolean) {
  const [value, setValue] = React.useState(initial)

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored !== null) setValue(stored === "true")
    } catch {}
  }, [key])

  const update = React.useCallback(
    (next: boolean) => {
      setValue(next)
      try {
        localStorage.setItem(key, String(next))
      } catch {}
    },
    [key]
  )

  return [value, update] as const
}

function useAutoClear(value: Feedback | null, clear: () => void, delay = 3000) {
  React.useEffect(() => {
    if (!value) return
    const id = setTimeout(clear, delay)
    return () => clearTimeout(id)
  }, [value, clear, delay])
}

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

function SectionHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

function GroupLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <h3
      className={cn(
        "mb-2 text-xs font-medium text-muted-foreground",
        className
      )}
    >
      {children}
    </h3>
  )
}

function Panel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "divide-y divide-border overflow-hidden rounded-xl border border-border",
        className
      )}
    >
      {children}
    </div>
  )
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-xs leading-snug text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function StatusMessage({
  type,
  children,
}: {
  type: "success" | "error"
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-xs",
        type === "success"
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-destructive/20 bg-destructive/5 text-destructive"
      )}
    >
      {children}
    </div>
  )
}

const THEME_OPTIONS = [
  { id: "light", label: "Light", icon: IconSun },
  { id: "dark", label: "Dark", icon: IconMoon },
  { id: "system", label: "System", icon: IconDeviceLaptop },
] as const

function GeneralSection() {
  const { theme, setTheme } = useTheme()
  const [autoScroll, setAutoScroll] = useStoredBoolean(
    "openbots:auto-scroll",
    true
  )
  const [audioCues, setAudioCues] = useStoredBoolean(
    "openbots:audio-cues",
    true
  )

  return (
    <>
      <SectionHeader
        title="General"
        description="Appearance and how the workspace behaves."
      />

      <div>
        <GroupLabel>Appearance</GroupLabel>
        <div className="grid grid-cols-3 gap-2.5">
          {THEME_OPTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id)}
              aria-pressed={theme === id}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                theme === id
                  ? "border-foreground/80 bg-muted text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <GroupLabel>Chat and workspace</GroupLabel>
        <Panel>
          <SettingRow
            title="Auto-scroll messages"
            description="Follow the conversation as new output arrives."
          >
            <Switch checked={autoScroll} onCheckedChange={setAutoScroll} />
          </SettingRow>
          <SettingRow
            title="Audio cues"
            description="Play a sound when a run finishes or needs attention."
          >
            <Switch checked={audioCues} onCheckedChange={setAudioCues} />
          </SettingRow>
        </Panel>
      </div>

      <div>
        <GroupLabel>Push Notifications</GroupLabel>
        <PushNotificationSetting />
      </div>
    </>
  )
}

function PushNotificationSetting() {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    sendTestNotification,
    isTesting,
  } = usePushNotifications()

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      await subscribe()
    } else {
      await unsubscribe()
    }
  }

  return (
    <Panel>
      <SettingRow
        title="Push notifications"
        description={
          !isSupported
            ? "Push notifications are not supported in this browser."
            : permission === "denied"
              ? "Notification permission was blocked in browser settings."
              : isSubscribed
                ? "Active: You'll receive background alerts when scheduled tasks run."
                : "Get notified when scheduled tasks and background agent runs complete."
        }
      >
        <div className="flex items-center gap-2">
          {isLoading ? (
            <Spinner className="size-4" />
          ) : (
            <Switch
              disabled={!isSupported || permission === "denied" || isLoading}
              checked={isSubscribed}
              onCheckedChange={handleToggle}
            />
          )}
        </div>
      </SettingRow>

      {isSubscribed && (
        <SettingRow
          title="Send test notification"
          description="Verify that desktop and lock-screen push alerts arrive on this device."
        >
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={isTesting}
            onClick={() => sendTestNotification()}
          >
            {isTesting && <Spinner className="size-3" />}
            Send test alert
          </Button>
        </SettingRow>
      )}

      {error && (
        <div className="p-3">
          <StatusMessage type="error">{error}</StatusMessage>
        </div>
      )}
    </Panel>
  )
}

function AccountSection({ onClose }: { onClose: () => void }) {
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

function ProviderKeyRow({
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

function ApiKeysSection() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
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
        headers,
        credentials: "include",
      })
      if (!res.ok) return NO_KEYS
      const json = (await res.json()) as { keys?: ConfiguredKeyInfo[] }
      const map: Record<string, ConfiguredKeyInfo> = {}
      for (const key of json.keys ?? []) map[key.provider] = key
      return map
    },
  })

  const configuredKeys = data ?? NO_KEYS

  const refresh = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
    [queryClient]
  )

  return (
    <>
      <SectionHeader
        title="API keys"
        description="Agents run on your own model keys. Keys are encrypted with AES-256-GCM before storage and are never shown back in plaintext."
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-5" />
        </div>
      ) : (
        <Panel>
          {LLM_PROVIDERS.map((meta) => (
            <ProviderKeyRow
              key={meta.provider}
              meta={meta}
              configured={configuredKeys[meta.provider]}
              onChanged={refresh}
            />
          ))}
        </Panel>
      )}
    </>
  )
}

function SecuritySection() {
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

function SessionsSection() {
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
              revokeMutation.isPending && revokeMutation.variables === revokeKey

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

const CONTENT_CLASS = "w-full space-y-8 p-6 outline-none"

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  const [activeTab, setActiveTab] = React.useState<SettingsTab>("general")
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:min-w-xl!">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Manage your profile, preferences, and account security.
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as SettingsTab)}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="shrink-0 px-4 pb-3">
            <TabsList className="grid w-full grid-cols-5">
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                <TabsTrigger key={id} value={id} className="gap-1.5 text-sm">
                  <Icon className="hidden size-4 sm:block" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className={SCROLL_CLASS}>
            <TabsContent value="general" className={CONTENT_CLASS}>
              <GeneralSection />
            </TabsContent>
            <TabsContent value="account" className={CONTENT_CLASS}>
              <AccountSection onClose={close} />
            </TabsContent>
            <TabsContent value="keys" className={CONTENT_CLASS}>
              <ApiKeysSection />
            </TabsContent>
            <TabsContent value="security" className={CONTENT_CLASS}>
              <SecuritySection />
            </TabsContent>
            <TabsContent value="sessions" className={CONTENT_CLASS}>
              <SessionsSection />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
