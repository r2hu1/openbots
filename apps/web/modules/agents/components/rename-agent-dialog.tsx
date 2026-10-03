"use client";

import { Button } from "@openbots/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openbots/ui/components/dialog";
import { Input } from "@openbots/ui/components/input";
import { Label } from "@openbots/ui/components/label";
import { Spinner } from "@openbots/ui/components/spinner";
import * as React from "react";
import type { Agent } from "../types";

interface RenameAgentDialogProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (updatedAgent: Agent) => void;
}

export function RenameAgentDialog({
  agent,
  open,
  onOpenChange,
  onSuccess,
}: RenameAgentDialogProps) {
  const [name, setName] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (agent && open) {
      setName(agent.name || "");
      setError(null);
    }
  }, [agent, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Agent name cannot be empty");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Failed to rename agent");
      }

      const data = await res.json();
      const updated = data.agent ?? { ...agent, name: trimmed };
      onSuccess?.(updated);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename agent");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename Agent</DialogTitle>
          <DialogDescription>Change your agents name.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-3">
            <Label htmlFor="agent-rename-input">Agent Name</Label>
            <Input
              id="agent-rename-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Research Assistant"
              disabled={isLoading}
              autoFocus
            />
            {error && <span className="text-xs text-destructive">{error}</span>}
          </div>

          <DialogFooter className="mt-2 flex items-center justify-end gap-2">
            <DialogClose
              render={
                <Button variant="outline" type="button" disabled={isLoading} />
              }
            >
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading && <Spinner />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
