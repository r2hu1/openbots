"use client";

import * as React from "react";

interface UseComposerDragDropOptions {
  disabled?: boolean;
  isSubmitting?: boolean;
  onProcessFiles: (files: File[]) => void;
}

export function useComposerDragDrop({
  disabled = false,
  isSubmitting = false,
  onProcessFiles,
}: UseComposerDragDropOptions) {
  const [isDragging, setIsDragging] = React.useState(false);
  const dragCounterRef = React.useRef(0);

  React.useEffect(() => {
    const onDragEnter = (event: DragEvent) => {
      event.preventDefault();
      dragCounterRef.current += 1;
      if (event.dataTransfer?.types?.includes("Files")) {
        setIsDragging(true);
      }
    };

    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    };

    const onDragLeave = (event: DragEvent) => {
      event.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDragging(false);
      }
    };

    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);

      if (disabled || isSubmitting) return;

      const dt = event.dataTransfer;
      if (!dt) return;

      const files = dt.files ? Array.from(dt.files) : [];
      if (files.length > 0) {
        onProcessFiles(files);
      }
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [disabled, isSubmitting, onProcessFiles]);

  return { isDragging };
}
