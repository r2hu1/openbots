"use client";

import { DocumentUpload } from "reicon-react";

interface DragDropOverlayProps {
  isDragging: boolean;
}

export function DragDropOverlay({ isDragging }: DragDropOverlayProps) {
  if (!isDragging) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-99 flex animate-in flex-col items-center justify-center gap-3 bg-background/75 backdrop-blur-sm duration-150 fade-in-0">
      <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-muted/50 text-foreground">
        <DocumentUpload className="size-6" />
      </div>

      <div className="text-center">
        <h3 className="text-sm font-medium text-foreground">
          Drop files to upload
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Images, documents, spreadsheets, or code
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Up to 10 files · 25 MB each
        </p>
      </div>
    </div>
  );
}
