"use client"

import { Button } from "@openbots/ui/components/button"
import { Spinner } from "@openbots/ui/components/spinner"
import {
  IconExternalLink,
  IconMaximize,
  IconMinimize,
  IconRefresh,
  IconWorld,
  IconX,
} from "@tabler/icons-react"
import * as React from "react"
import { cn } from "@/lib/utils"

interface BrowserLivePreviewProps {
  liveViewUrl: string | null
  currentUrl?: string | null
  title?: string | null
  isOpen: boolean
  onClose: () => void
  className?: string
}

export function BrowserLivePreview({
  liveViewUrl,
  currentUrl,
  title,
  isOpen,
  onClose,
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
        "flex flex-col border-l border-border bg-background transition-all duration-300 ease-in-out",
        isFullscreen
          ? "fixed inset-0 z-50 h-full w-screen border-l-0"
          : "h-full w-[420px] shrink-0 xl:w-[480px]",
        className
      )}
    >
      {/* Browser Bar Header */}
      <div className="flex h-12 items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2 select-none">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex shrink-0 items-center gap-1.5 text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <IconWorld className="size-4 text-muted-foreground" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-xs font-medium text-foreground">
              {title || "Live Cloud Browser"}
            </span>
            {currentUrl && (
              <span className="truncate font-mono text-[10px] text-muted-foreground">
                {currentUrl}
              </span>
            )}
          </div>
        </div>

        {/* Browser Preview Controls */}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={reloadIframe}
            title="Reload live view"
            aria-label="Reload preview"
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
          >
            <IconExternalLink className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            aria-label="Toggle Fullscreen"
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
          >
            <IconX className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Live Interactive Iframe */}
      <div className="relative flex-1 overflow-hidden bg-black/5 dark:bg-black/40">
        {isLoading && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-xs">
            <Spinner className="size-5 text-primary" />
            <span className="animate-pulse text-xs text-muted-foreground">
              Connecting to Browserbase live session...
            </span>
          </div>
        )}

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
  )
}
