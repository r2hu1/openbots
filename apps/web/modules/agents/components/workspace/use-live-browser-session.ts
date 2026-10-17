"use client"

import * as React from "react"
import type { MessageItem } from "@/modules/conversations/types"
import type { StepItem } from "@/modules/runs/types"
import { extractLiveBrowserData, type LiveBrowserInfo } from "./live-browser-extractor"

const SCREEN_TOOL_NAMES = [
  "mouse_click",
  "mouse_move",
  "mouse_scroll",
  "keyboard_type",
  "show_screen",
  "take_screenshot",
  "browser_screenshot",
  "browser_navigate",
  "browser_click",
  "browser_type",
  "browser_scroll",
  "browser_extract_content",
  "browser_wait_for_user",
]

interface UseLiveBrowserSessionProps {
  activeConversationId: string | null
  activeRunId?: string | null
  activeRunSteps: StepItem[]
  messages: MessageItem[]
  conversationInfiniteData: any
  isActiveRun: boolean
}

export function useLiveBrowserSession({
  activeConversationId,
  activeRunId,
  activeRunSteps,
  messages,
  conversationInfiniteData,
  isActiveRun,
}: UseLiveBrowserSessionProps) {
  const lastKnownBrowserRef = React.useRef<{
    conversationId: string | null
    data: LiveBrowserInfo
  } | null>(null)

  React.useEffect(() => {
    if (
      lastKnownBrowserRef.current &&
      lastKnownBrowserRef.current.conversationId !== activeConversationId
    ) {
      lastKnownBrowserRef.current = null
    }
  }, [activeConversationId])

  const liveBrowserData = React.useMemo<LiveBrowserInfo | null>(() => {
    const extracted = extractLiveBrowserData(activeRunSteps, messages, conversationInfiniteData)
    if (extracted) {
      lastKnownBrowserRef.current = { conversationId: activeConversationId, data: extracted }
      return extracted
    }

    if (
      lastKnownBrowserRef.current &&
      lastKnownBrowserRef.current.conversationId === activeConversationId
    ) {
      return lastKnownBrowserRef.current.data
    }

    return null
  }, [activeRunSteps, messages, conversationInfiniteData, activeConversationId])

  const [previewManuallyClosed, setPreviewManuallyClosed] = React.useState(false)

  const isAgentUsingScreen = React.useMemo(() => {
    if (activeRunSteps.length > 0) {
      return Boolean(activeRunSteps.find((s) => SCREEN_TOOL_NAMES.includes(s.toolName || "")))
    }
    return false
  }, [activeRunSteps])

  const activeHitlPrompt = React.useMemo(() => {
    if (!activeRunId) return null
    const pendingStep = [...activeRunSteps]
      .reverse()
      .find((s) => s.toolName === "browser_wait_for_user" && s.status === "running")
    if (!pendingStep) return null

    const input = (pendingStep.toolInput || {}) as Record<string, any>
    const instruction =
      (typeof input.instruction === "string" ? input.instruction : null) ||
      (typeof input.message === "string" ? input.message : null) ||
      "Please complete the action in the browser."

    return { runId: activeRunId, instruction }
  }, [activeRunId, activeRunSteps])

  const [userExplicitlyToggled, setUserExplicitlyToggled] = React.useState(false)

  React.useEffect(() => {
    if (activeHitlPrompt || isAgentUsingScreen) {
      setPreviewManuallyClosed(false)
    }
  }, [isAgentUsingScreen, activeHitlPrompt])

  const isBrowserClosed = React.useMemo(() => {
    let closeStepIndex = -1
    for (let i = activeRunSteps.length - 1; i >= 0; i--) {
      if (activeRunSteps[i]?.toolName === "browser_close") {
        closeStepIndex = i
        break
      }
    }

    if (closeStepIndex !== -1) {
      let subsequentOpenIndex = -1
      for (let i = closeStepIndex + 1; i < activeRunSteps.length; i++) {
        const name = activeRunSteps[i]?.toolName
        if (name === "browser_navigate" || name === "show_screen") {
          subsequentOpenIndex = i
          break
        }
      }
      if (subsequentOpenIndex === -1) return true
    }

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (!msg) continue
      const meta = msg.metadata as Record<string, any> | null
      if (Array.isArray(meta?.steps)) {
        for (let j = meta.steps.length - 1; j >= 0; j--) {
          const step = meta.steps[j]
          if (step?.toolName === "browser_close") return true
          if (step?.toolName === "browser_navigate" || step?.toolName === "show_screen") return false
        }
      }
    }
    return false
  }, [activeRunSteps, messages])

  React.useEffect(() => {
    if (isBrowserClosed) {
      lastKnownBrowserRef.current = null
    }
  }, [isBrowserClosed])

  const conversationActiveBrowser = conversationInfiniteData?.pages?.[0]?.activeBrowser as Record<string, any> | undefined | null

  const hasLiveBrowser = Boolean(
    !isBrowserClosed &&
    liveBrowserData?.liveViewUrl &&
    (Boolean(activeHitlPrompt) ||
      (isActiveRun && isAgentUsingScreen) ||
      userExplicitlyToggled ||
      conversationActiveBrowser?.liveDebuggerFullscreenUrl ||
      conversationActiveBrowser?.liveDebuggerUrl ||
      conversationActiveBrowser?.liveViewUrl ||
      conversationActiveBrowser?.vncUrl)
  )

  const isLivePreviewOpen = Boolean(
    hasLiveBrowser &&
    !previewManuallyClosed &&
    (Boolean(activeHitlPrompt) ||
      (isActiveRun && isAgentUsingScreen) ||
      userExplicitlyToggled)
  )

  const toggleBrowser = React.useCallback(() => {
    setPreviewManuallyClosed((prev) => {
      const willClose = !prev
      setUserExplicitlyToggled(!willClose)
      return willClose
    })
  }, [])

  const handleClosePreview = React.useCallback(() => {
    lastKnownBrowserRef.current = null
    setPreviewManuallyClosed(true)
  }, [])

  return {
    liveBrowserData,
    activeHitlPrompt,
    hasLiveBrowser,
    isLivePreviewOpen,
    toggleBrowser,
    handleClosePreview,
  }
}
