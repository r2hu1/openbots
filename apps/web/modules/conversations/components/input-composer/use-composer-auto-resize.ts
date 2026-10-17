"use client";

import * as React from "react";

interface UseComposerAutoResizeOptions {
  text: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function useComposerAutoResize({
  text,
  textareaRef,
}: UseComposerAutoResizeOptions) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Auto-resize (animated) + switch between inline and expanded layout.
  React.useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    if (text.length === 0) {
      if (isExpanded) setIsExpanded(false);
      el.style.height = "32px";
      el.style.overflowY = "hidden";
      return;
    }

    const prev = el.offsetHeight;
    el.style.height = "auto";
    const full = el.scrollHeight;

    if (!isExpanded && text.length > 0 && (text.includes("\n") || full > 44)) {
      setIsExpanded(true);
    }

    el.style.overflowY = full > 240 ? "auto" : "hidden";
    el.style.height = `${prev}px`;
    void el.offsetHeight;
    el.style.height = `${Math.min(Math.max(full, 32), 240)}px`;
  }, [text, isExpanded, textareaRef]);

  return { isExpanded };
}
