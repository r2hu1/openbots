"use client";

import { Button } from "@openbots/ui/components/button";
import { Spinner } from "@openbots/ui/components/spinner";
import { Textarea } from "@openbots/ui/components/textarea";
import { IconArrowUp, IconPlayerStop } from "@tabler/icons-react";
import * as React from "react";

interface InputComposerProps {
  onSend: (prompt: string) => void;
  isSubmitting?: boolean;
  isActiveRun?: boolean;
  onCancelRun?: () => void;
  isCancelling?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export function InputComposer({
  onSend,
  isSubmitting = false,
  isActiveRun = false,
  onCancelRun,
  isCancelling = false,
  placeholder = "Message your agent...",
  disabled = false,
}: InputComposerProps) {
  const [text, setText] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const isDisabled = disabled || isSubmitting;
  const canSubmit = text.trim().length > 0 && !isDisabled && !isActiveRun;

  const resizeTextarea = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 192)}px`;
  }, []);

  React.useEffect(() => {
    resizeTextarea();
  }, [resizeTextarea]);

  const handleSubmit = React.useCallback(() => {
    const prompt = text.trim();
    if (!prompt || !canSubmit) {
      return;
    }

    onSend(prompt);
    setText("");

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [text, canSubmit, onSend]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  };

  return (
    <div className="w-full px-3 pb-3">
      <div className="mx-auto max-w-3xl">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <div className="relative overflow-hidden rounded-3xl border border-border bg-background transition focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isDisabled || isActiveRun}
              rows={1}
              className="max-h-48 min-h-12 resize-none overflow-y-auto border-0 bg-transparent px-4 py-3.5 pr-14 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />

            <div className="absolute right-2 bottom-2">
              {isActiveRun && onCancelRun ? (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  onClick={onCancelRun}
                  disabled={isCancelling}
                  className="size-8 rounded-full"
                  aria-label="Stop run"
                >
                  {isCancelling ? (
                    <Spinner className="size-4" />
                  ) : (
                    <IconPlayerStop className="size-4" />
                  )}
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={!canSubmit}
                  className="size-8 rounded-full"
                  aria-label="Send message"
                >
                  {isSubmitting ? (
                    <Spinner className="size-4" />
                  ) : (
                    <IconArrowUp className="size-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
