import type * as React from "react";
import {
  Devices as IconDevices,
  Key as IconKey,
  Palette as IconPalette,
  Plug2 as IconPlug,
  Settings as IconSettings,
  Shield as IconShield,
  User as IconUser,
} from "reicon-react";

export type SettingsTab =
  | "general"
  | "appearance"
  | "connections"
  | "account"
  | "keys"
  | "security"
  | "sessions";

export const NAV_ITEMS: Array<{
  id: SettingsTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "general", label: "General", icon: IconSettings },
  { id: "appearance", label: "Appearance", icon: IconPalette },
  { id: "connections", label: "Connections", icon: IconPlug },
  { id: "account", label: "Account", icon: IconUser },
  { id: "keys", label: "API keys", icon: IconKey },
  { id: "security", label: "Security", icon: IconShield },
  { id: "sessions", label: "Sessions", icon: IconDevices },
];
