"use client"

import dynamic from "next/dynamic"
import * as React from "react"
import { ResizablePanel } from "@openbots/ui/components/resizable"

const BrowserLivePreview = dynamic(
  () => import("@/modules/desktop/desktop-live-preview").then((m) => m.BrowserLivePreview),
  { ssr: false }
)

interface WorkspaceDesktopPanelProps {
  isOpen: boolean
  liveViewUrl: string | null
  currentUrl?: string
  title?: string
  onClose: () => void
  hitlPrompt: { runId: string; instruction: string } | null
  onHitlResponse: (runId: string, action: "completed" | "skipped") => void
  isSubmittingHitl: boolean
  agentName: string
}

export function WorkspaceDesktopPanel({
  isOpen,
  liveViewUrl,
  currentUrl,
  title,
  onClose,
  hitlPrompt,
  onHitlResponse,
  isSubmittingHitl,
  agentName,
}: WorkspaceDesktopPanelProps) {
  return (
    <ResizablePanel
      defaultSize={700}
      minSize={500}
      maxSize={900}
      className="flex min-w-0 flex-col"
    >
      <BrowserLivePreview
        isOpen={isOpen}
        liveViewUrl={liveViewUrl}
        currentUrl={currentUrl}
        title={title}
        onClose={onClose}
        hitlPrompt={hitlPrompt}
        onHitlResponse={onHitlResponse}
        isSubmittingHitl={isSubmittingHitl}
        agentName={agentName}
      />
    </ResizablePanel>
  )
}
