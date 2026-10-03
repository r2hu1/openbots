"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@openbots/ui/components/alert-dialog";
import { Button } from "@openbots/ui/components/button";
import * as React from "react";
import type { Agent } from "../types";

interface DeleteAgentDialogProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (deletedId: string) => void;
}

export function DeleteAgentDialog({
  agent,
  open,
  onOpenChange,
  onSuccess,
}: DeleteAgentDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleDelete = async () => {
    if (!agent) return;

    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Failed to delete agent");
      }

      onSuccess?.(agent.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete agent");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Agent</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">
              {agent?.name || "this agent"}
            </span>
            ? This will permanently remove the agent, its configurations, and
            conversation history. This action cannot be undone.
          </AlertDialogDescription>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? "Deleting..." : "Delete Agent"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
