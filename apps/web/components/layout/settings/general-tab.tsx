"use client"

import { Button } from "@openbots/ui/components/button"
import { Spinner } from "@openbots/ui/components/spinner"
import { Switch } from "@openbots/ui/components/switch"
import * as React from "react"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import {
  GroupLabel,
  Panel,
  SectionHeader,
  SettingRow,
  StatusMessage,
  useStoredBoolean,
} from "./settings-shared"

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

export function GeneralTab() {
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
        description="Configure how the workspace and background notifications behave."
      />

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
