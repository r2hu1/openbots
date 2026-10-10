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

export interface HitlPromptData {
  instruction: string
  runId: string
  contextKey?: string
}

interface BrowserLivePreviewProps {
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
      <div className="mt-10 flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-muted/30 px-3 py-1.5 select-none">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground/90 uppercase">
              Live Browser
            </span>
          </div>

          {currentUrl ? (
            <div className="flex max-w-[280px] min-w-0 items-center rounded-md border border-border/50 bg-background/70 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              <span className="truncate">{currentUrl}</span>
            </div>
          ) : title ? (
            <span className="truncate text-xs font-medium text-foreground/80">
              {title}
            </span>
          ) : null}
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
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-3.5 py-2 transition-all">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <IconHandClick className="size-3.5 animate-bounce" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[11px] font-semibold tracking-wider text-amber-600 uppercase dark:text-amber-400">
                Your Input Needed
              </span>
              <span className="truncate text-xs font-medium text-foreground">
                {hitlPrompt.instruction}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="outline"
              size="xs"
              disabled={isSubmittingHitl}
              onClick={() => onHitlResponse?.(hitlPrompt.runId, "skipped")}
              className="h-7 border-amber-500/30 text-xs text-muted-foreground hover:bg-amber-500/10"
            >
              Skip
            </Button>
            <Button
              variant="default"
              size="xs"
              disabled={isSubmittingHitl}
              onClick={() => onHitlResponse?.(hitlPrompt.runId, "completed")}
              className="h-7 gap-1 bg-amber-600 text-xs font-medium text-white shadow-xs hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
            >
              {isSubmittingHitl ? (
                <Spinner className="size-3" />
              ) : (
                <IconCheck className="size-3" />
              )}
              I&apos;m Done (Continue)
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
              Connecting to Browserbase live session...
            </span>
          </div>
        )}

        <div className="relative flex h-full max-h-[85vh] w-full max-w-5xl items-center justify-center overflow-hidden rounded-xl border border-border/80 bg-background shadow-md">
          <iframe
            key={iframeKey}
            src={liveViewUrl}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-pointer-lock allow-downloads"
            allow="clipboard-read; clipboard-write; autoplay; fullscreen"
            className="relative z-0 h-full w-full border-0"
            onLoad={() => setIsLoading(false)}
          />
        </div>
      </div>
    </div>
  )
}
