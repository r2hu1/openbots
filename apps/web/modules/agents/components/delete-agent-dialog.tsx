"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@openbots/ui/components/alert-dialog"
import { Button } from "@openbots/ui/components/button"
import * as React from "react"
import type { Agent } from "../types"
import { getClient } from "@/lib/api"
import { useRouter } from "next/navigation"
import { ArrowRight, Trash2, Trash3 } from "reicon-react"
import { Blobatar } from "@openbots/ui/components/ui/blobatar"
import { Spinner } from "@openbots/ui/components/spinner"

interface DeleteAgentDialogProps {
  agent: Agent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (deletedId: string) => void
}

export function DeleteAgentDialog({
  agent,
  open,
  onOpenChange,
  onSuccess,
}: DeleteAgentDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const router = useRouter()

  const handleDelete = async () => {
    if (!agent) return

    try {
      setIsLoading(true)
      setError(null)
      const client = getClient()
      const res = await client.api.agents[":id"].$delete({
        param: { id: agent.id },
      })

      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(errData?.error || "Failed to delete agent")
      }

      onSuccess?.(agent.id)
      onOpenChange(false)
      router.replace("/")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete agent")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <Blobatar
              name={agent?.name || "Agent"}
              className="size-9"
              blobatar={{ animate: "always" }}
            />
            <ArrowRight className="size-4 opacity-70" />
            <div className="flex size-9 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <Trash3 className="size-5" />
            </div>
          </div>
          <AlertDialogTitle>Delete {agent?.name || "Agent"}</AlertDialogTitle>
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
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading && <Spinner />}
            Delete {agent?.name ?? "Agent"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
