"use client";

import * as React from "react";

interface ParsedHotkey {
  key: string;
  mod: boolean;
  shift: boolean;
  alt: boolean;
}

function parseHotkey(spec: string): ParsedHotkey {
  const parts = spec.toLowerCase().split("+");
  return {
    key: parts[parts.length - 1] ?? "",
    mod: parts.includes("mod"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt"),
  };
}

export function isMacPlatform() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function matches(e: KeyboardEvent, hotkey: ParsedHotkey, mac: boolean) {
  const modPressed = mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  if (hotkey.mod !== modPressed) return false;
  if (hotkey.shift !== e.shiftKey) return false;
  if (hotkey.alt !== e.altKey) return false;

  const keyMatch = e.key.toLowerCase() === hotkey.key;
  const codeMatch =
    hotkey.key.length === 1 && e.code === `Key${hotkey.key.toUpperCase()}`;
  return keyMatch || codeMatch;
}

export function useHotkey(
  spec: string,
  handler: (event: KeyboardEvent) => void,
  enabled = true,
) {
  const handlerRef = React.useRef(handler);

  React.useEffect(() => {
    handlerRef.current = handler;
  });

  React.useEffect(() => {
    if (!enabled) return;
    const hotkey = parseHotkey(spec);
    const mac = isMacPlatform();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.isComposing) return;
      if (!matches(e, hotkey, mac)) return;
      e.preventDefault();
      handlerRef.current(e);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [spec, enabled]);
}

export function useShortcutLabel(spec: string) {
  const [mac, setMac] = React.useState(true);

  React.useEffect(() => {
    setMac(isMacPlatform());
  }, []);

  const { key, mod, shift, alt } = parseHotkey(spec);
  const letter = key.toUpperCase();

  if (mac) {
    return `${mod ? "⌘" : ""}${alt ? "⌥" : ""}${shift ? "⇧" : ""}${letter}`;
  }
  return [mod && "Ctrl", alt && "Alt", shift && "Shift", letter]
    .filter(Boolean)
    .join("+");
}
