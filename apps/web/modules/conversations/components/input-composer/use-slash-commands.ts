"use client";

import * as React from "react";
import { SLASH_COMMANDS } from "./slash-commands";
import type { SlashCommand } from "./types";

interface UseSlashCommandsOptions {
  text: string;
  setText: React.Dispatch<React.SetStateAction<string>>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function useSlashCommands({
  text,
  setText,
  textareaRef,
}: UseSlashCommandsOptions) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [isDismissed, setIsDismissed] = React.useState(false);
  const commandListRef = React.useRef<HTMLDivElement>(null);

  const slashMatch = React.useMemo(() => {
    if (isDismissed) return null;
    const match = text.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/);
    if (!match) return null;

    return {
      query: (match[1] ?? "").toLowerCase(),
      startIndex: match.index! + (match[0].startsWith(" ") ? 1 : 0),
    };
  }, [text, isDismissed]);

  const filteredCommands = React.useMemo(() => {
    if (!slashMatch) return [];
    const q = slashMatch.query;
    if (!q) return SLASH_COMMANDS;

    return SLASH_COMMANDS.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(q) ||
        cmd.label.toLowerCase().includes(q) ||
        cmd.insertText.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q),
    );
  }, [slashMatch]);

  const isMenuOpen = slashMatch !== null && filteredCommands.length > 0;

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands.length]);

  React.useEffect(() => {
    if (!isMenuOpen || !commandListRef.current) return;

    const activeItem = commandListRef.current.querySelector(
      `[data-index="${selectedIndex}"]`,
    ) as HTMLElement | null;

    if (activeItem) {
      activeItem.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, isMenuOpen]);

  const handleSelectCommand = React.useCallback(
    (command: SlashCommand) => {
      const insertion = `${command.insertText} `;
      if (!slashMatch) {
        setText(insertion);
      } else {
        const before = text.slice(0, slashMatch.startIndex);
        const newText = `${before}${insertion}`;
        setText(newText);
      }

      setIsDismissed(false);

      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.focus();
          const length = textarea.value.length;
          textarea.setSelectionRange(length, length);
        }
      });
    },
    [slashMatch, text, setText, textareaRef],
  );

  return {
    isMenuOpen,
    filteredCommands,
    selectedIndex,
    setSelectedIndex,
    isDismissed,
    setIsDismissed,
    commandListRef,
    handleSelectCommand,
  };
}
