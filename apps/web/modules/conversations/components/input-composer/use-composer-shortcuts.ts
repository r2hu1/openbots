"use client";

import * as React from "react";

interface UseComposerShortcutsOptions {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  replyTarget?: import("../../types").ReplyTarget | null;
}

export function useComposerShortcuts({
  textareaRef,
  replyTarget,
}: UseComposerShortcutsOptions) {
  // Press "/" anywhere on the page to focus the composer
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.isComposing) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const textarea = textareaRef.current;
      if (!textarea || textarea.disabled) return;

      event.preventDefault();
      textarea.focus();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [textareaRef]);

  // Focus textarea when a reply is initiated
  React.useEffect(() => {
    if (replyTarget) {
      textareaRef.current?.focus();
    }
  }, [replyTarget, textareaRef]);
}
