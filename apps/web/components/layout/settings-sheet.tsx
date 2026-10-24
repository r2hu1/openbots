"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@openbots/ui/components/sheet";
import { Tabs, TabsContent } from "@openbots/ui/components/tabs";
import * as React from "react";
import { AccountTab } from "./settings/account-tab";
import { ApiKeysTab } from "./settings/api-keys-tab";
import { AppearanceTab } from "./settings/appearance-tab";
import { ConnectionsTab } from "./settings/connections-tab";
import { GeneralTab } from "./settings/general-tab";
import { SecurityTab } from "./settings/security-tab";
import { SessionsTab } from "./settings/sessions-tab";
import { SCROLL_CLASS } from "./settings/settings-shared";
import type { SettingsTab } from "./settings/settings-tab-items";
import { SettingsTabNav } from "./settings/settings-tab-nav";

export type {
  ConfiguredKeyInfo,
  ProviderKeyMeta,
  SupportedLlmProvider,
} from "./settings/api-keys-tab";
export { LLM_PROVIDERS } from "./settings/api-keys-tab";
export type { SettingsTab } from "./settings/settings-tab-items";

export interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: SettingsTab;
}

const CONTENT_CLASS = "w-full space-y-8 p-6 outline-none";

export function SettingsSheet({
  open,
  onOpenChange,
  initialTab = "general",
}: SettingsSheetProps) {
  const [activeTab, setActiveTab] = React.useState<SettingsTab>(initialTab);
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);

  React.useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex min-h-0 w-full flex-col sm:min-w-2xl!"
      >
        <SheetHeader className="shrink-0">
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
          <SettingsTabNav
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            isOpen={open}
          />

          <div className={`${SCROLL_CLASS} min-h-0 flex-1`}>
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
  );
}
