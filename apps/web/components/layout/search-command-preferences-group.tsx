"use client";

import * as React from "react";
import { CommandGroup, CommandItem } from "@openbots/ui/components/command";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Check, Devices, Logout, Moon3, Sun2 } from "reicon-react";
import { signOut } from "@/lib/auth-client";

interface SearchCommandPreferencesGroupProps {
  onSelectAction: (action: () => void | Promise<void>) => void;
}

export function SearchCommandPreferencesGroup({
  onSelectAction,
}: SearchCommandPreferencesGroupProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  return (
    <CommandGroup heading="Preferences & Actions">
      <CommandItem
        value="theme switch toggle light mode"
        onSelect={() => onSelectAction(() => setTheme("light"))}
        className="relative"
      >
        <Sun2 className="size-4" />
        <span>Light Theme</span>
        {theme === "light" && <Check className="absolute right-2 size-4" />}
      </CommandItem>
      <CommandItem
        value="theme switch toggle dark mode"
        className="relative"
        onSelect={() => onSelectAction(() => setTheme("dark"))}
      >
        <Moon3 className="size-4" />
        <span>Dark Theme</span>
        {theme === "dark" && <Check className="absolute right-2 size-4" />}
      </CommandItem>
      <CommandItem
        value="theme system auto"
        className="relative w-full"
        onSelect={() => onSelectAction(() => setTheme("system"))}
      >
        <Devices className="size-4" />
        <span>System Theme</span>
        {theme === "system" && <Check className="absolute right-2 size-4" />}
      </CommandItem>
      <CommandItem
        value="log out sign out exit account"
        onSelect={() =>
          onSelectAction(async () => {
            await signOut();
            router.replace("/login");
          })
        }
      >
        <Logout className="size-4" />
        <span>Log out</span>
      </CommandItem>
    </CommandGroup>
  );
}
