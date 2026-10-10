"use client"

import { Button } from "@openbots/ui/components/button"
import { Spinner } from "@openbots/ui/components/spinner"
import {
  IconCheck,
  IconExternalLink,
  IconHandClick,
  IconMaximize,
  IconMinimize,
  IconRefresh,
  IconWorld,
  IconX,
} from "@tabler/icons-react"
import * as React from "react"
import { cn } from "@/lib/utils"
import { Check, Display, Hand } from "reicon-react"

export interface HitlPromptData {
  instruction: string
  runId: string
  contextKey?: string
}

interface BrowserLivePreviewProps {
  agentName?: string
  liveViewUrl: string | null
  currentUrl?: string | null
  title?: string | null
  isOpen: boolean
  onClose: () => void
  hitlPrompt?: HitlPromptData | null
  onHitlResponse?: (runId: string, action: "completed" | "skipped") => void
  isSubmittingHitl?: boolean
  className?: string
}

export function BrowserLivePreview({
  agentName,
  liveViewUrl,
  currentUrl,
  title,
  isOpen,
  onClose,
  hitlPrompt,
  onHitlResponse,
  isSubmittingHitl = false,
  className,
}: BrowserLivePreviewProps) {
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [iframeKey, setIframeKey] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    setIsLoading(true)
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 6000)
    return () => clearTimeout(timer)
  }, [liveViewUrl, iframeKey])

  if (!isOpen || !liveViewUrl) {
    return null
  }

  const reloadIframe = () => {
    setIsLoading(true)
    setIframeKey((prev) => prev + 1)
  }

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col bg-background transition-all duration-200 ease-in-out",
        isFullscreen &&
          "fixed inset-0 z-50 h-screen w-screen border-0 bg-background/95 p-3 backdrop-blur-md",
        className
      )}
    >
      {/* Browser Bar Header */}
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-muted/30 px-3 py-1.5 pl-4 select-none">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex shrink-0 items-center gap-2">
            <Display className="size-3" />
            <span className="text-[11px] font-medium tracking-wide capitalize">
              {agentName}'s View
            </span>
          </div>
        </div>

        {/* Browser Preview Controls */}
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={reloadIframe}
            title="Reload live view"
            aria-label="Reload preview"
            className="rounded-full text-muted-foreground hover:text-foreground"
          >
            <IconRefresh className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() =>
              window.open(liveViewUrl, "_blank", "noopener,noreferrer")
            }
            title="Open Live View in full window"
            aria-label="Open Live View in full window"
            className="rounded-full text-muted-foreground hover:text-foreground"
          >
            <IconExternalLink className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            aria-label="Toggle Fullscreen"
            className="rounded-full text-muted-foreground hover:text-foreground"
          >
            {isFullscreen ? (
              <IconMinimize className="size-3.5" />
            ) : (
              <IconMaximize className="size-3.5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            title="Close Preview"
            aria-label="Close Preview"
            className="rounded-full text-muted-foreground hover:text-foreground"
          >
            <IconX className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Human in the Loop (HITL) Alert Banner */}
      {hitlPrompt && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-primary px-3 py-1.5 text-primary-foreground transition-all">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full">
              <Hand className="size-3.5 animate-pulse" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[11px] font-semibold tracking-wider">
                Your Input Needed
              </span>
              <span className="truncate text-xs font-medium text-foreground">
                {hitlPrompt?.instruction}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="xs"
              disabled={isSubmittingHitl}
              onClick={() => onHitlResponse?.(hitlPrompt.runId, "skipped")}
              className="h-7 text-xs"
            >
              Skip
            </Button>
            <Button
              variant="secondary"
              size="xs"
              disabled={isSubmittingHitl}
              onClick={() => onHitlResponse?.(hitlPrompt.runId, "completed")}
              className="h-7 gap-1 text-xs"
            >
              {isSubmittingHitl ? (
                <Spinner className="size-3" />
              ) : (
                <Check className="size-3" />
              )}
              I&apos;m Done
            </Button>
          </div>
        </div>
      )}

      {/* Centered Browser Canvas Container */}
      <div className="relative flex flex-1 items-center justify-center overflow-auto bg-muted/20 p-4 sm:p-6">
        {isLoading && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-xs">
            <Spinner className="size-5 text-primary" />
            <span className="animate-pulse text-xs text-muted-foreground">
              Connecting to live browser session...
            </span>
          </div>
        )}

        <div className="relative flex aspect-[16/10] h-auto max-h-full w-full max-w-5xl items-center justify-center overflow-hidden rounded-lg border border-border/80 bg-background shadow-xs">
          <iframe
            key={iframeKey}
            src={liveViewUrl}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-pointer-lock allow-downloads"
            allow="clipboard-read; clipboard-write; autoplay; fullscreen"
            className="relative z-0 size-full border-0"
            onLoad={() => setIsLoading(false)}
          />
        </div>
      </div>
    </div>
  )
}
