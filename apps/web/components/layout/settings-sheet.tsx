"use client"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@openbots/ui/components/sheet"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openbots/ui/components/tabs"
import * as React from "react"
import {
  Devices as IconDevices,
  Key as IconKey,
  Palette as IconPalette,
  Plug2 as IconPlug,
  Settings as IconSettings,
  Shield as IconShield,
  User as IconUser,
} from "reicon-react"
import { AccountTab } from "./settings/account-tab"
import { ApiKeysTab } from "./settings/api-keys-tab"
import { AppearanceTab } from "./settings/appearance-tab"
import { ConnectionsTab } from "./settings/connections-tab"
import { GeneralTab } from "./settings/general-tab"
import { SecurityTab } from "./settings/security-tab"
import { SessionsTab } from "./settings/sessions-tab"
import { SCROLL_CLASS } from "./settings/settings-shared"

export type {
  ConfiguredKeyInfo,
  ProviderKeyMeta,
  SupportedLlmProvider,
} from "./settings/api-keys-tab"
export { LLM_PROVIDERS } from "./settings/api-keys-tab"

export type SettingsTab =
  | "general"
  | "appearance"
  | "connections"
  | "account"
  | "keys"
  | "security"
  | "sessions"

export interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTab?: SettingsTab
}

const NAV_ITEMS: Array<{
  id: SettingsTab
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: "general", label: "General", icon: IconSettings },
  { id: "appearance", label: "Appearance", icon: IconPalette },
  { id: "connections", label: "Connections", icon: IconPlug },
  { id: "account", label: "Account", icon: IconUser },
  { id: "keys", label: "API keys", icon: IconKey },
  { id: "security", label: "Security", icon: IconShield },
  { id: "sessions", label: "Sessions", icon: IconDevices },
]

const CONTENT_CLASS = "w-full space-y-8 p-6 outline-none"

export function SettingsSheet({
  open,
  onOpenChange,
  initialTab = "general",
}: SettingsSheetProps) {
  const [activeTab, setActiveTab] = React.useState<SettingsTab>(initialTab)
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange])

  React.useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab)
    }
  }, [open, initialTab])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:min-w-xl!">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Manage your profile, preferences, connections, and account security.
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as SettingsTab)}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="shrink-0 px-4 pb-3">
            <TabsList className="grid w-full grid-cols-7">
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="gap-1.5 px-2 text-xs sm:text-sm"
                >
                  <Icon className="hidden size-4 sm:block" />
                  <span className="truncate">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className={SCROLL_CLASS}>
            <TabsContent value="general" className={CONTENT_CLASS}>
              <GeneralTab />
            </TabsContent>
            <TabsContent value="appearance" className={CONTENT_CLASS}>
              <AppearanceTab />
            </TabsContent>
            <TabsContent value="connections" className={CONTENT_CLASS}>
              <ConnectionsTab />
            </TabsContent>
            <TabsContent value="account" className={CONTENT_CLASS}>
              <AccountTab onClose={close} />
            </TabsContent>
            <TabsContent value="keys" className={CONTENT_CLASS}>
              <ApiKeysTab />
            </TabsContent>
            <TabsContent value="security" className={CONTENT_CLASS}>
              <SecurityTab />
            </TabsContent>
            <TabsContent value="sessions" className={CONTENT_CLASS}>
              <SessionsTab />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
