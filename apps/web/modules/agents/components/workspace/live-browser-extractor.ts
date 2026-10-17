import type { MessageItem } from "@/modules/conversations/types"
import type { StepItem } from "@/modules/runs/types"

export interface LiveBrowserInfo {
  liveViewUrl: string
  currentUrl?: string
  title?: string
}

export function extractLiveBrowserData(
  activeRunSteps: StepItem[],
  messages: MessageItem[],
  conversationInfiniteData: any
): LiveBrowserInfo | null {
  for (let i = activeRunSteps.length - 1; i >= 0; i--) {
    const step = activeRunSteps[i]
    if (!step) continue
    const output = step.toolOutput as Record<string, any> | null
    if (output?.liveViewUrl) {
      return {
        liveViewUrl: output.liveViewUrl as string,
        currentUrl: (output.currentUrl || output.url) as string | undefined,
        title: output.title as string | undefined,
      }
    }
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (!msg) continue
    const meta = msg.metadata as Record<string, any> | null
    if (meta?.liveViewUrl) {
      return {
        liveViewUrl: meta.liveViewUrl as string,
        currentUrl: (meta.currentUrl || meta.url) as string | undefined,
        title: meta.title as string | undefined,
      }
    }
    if (Array.isArray(meta?.steps)) {
      for (let j = meta.steps.length - 1; j >= 0; j--) {
        const step = meta.steps[j]
        const output = step?.toolOutput as Record<string, any> | null
        if (output?.liveViewUrl) {
          return {
            liveViewUrl: output.liveViewUrl as string,
            currentUrl: (output.currentUrl || output.url) as string | undefined,
            title: output.title as string | undefined,
          }
        }
      }
    }
    if (typeof msg.content === "object" && msg.content !== null) {
      const contentObj = msg.content as Record<string, any>
      if (contentObj.liveViewUrl) {
        return {
          liveViewUrl: contentObj.liveViewUrl as string,
          currentUrl: (contentObj.currentUrl || contentObj.url) as string | undefined,
          title: contentObj.title as string | undefined,
        }
      }
    }
  }

  const conversationActiveBrowser = conversationInfiniteData?.pages?.[0]?.activeBrowser as Record<string, any> | undefined | null
  if (
    conversationActiveBrowser?.liveDebuggerFullscreenUrl ||
    conversationActiveBrowser?.liveDebuggerUrl ||
    conversationActiveBrowser?.liveViewUrl ||
    conversationActiveBrowser?.vncUrl
  ) {
    return {
      liveViewUrl: (conversationActiveBrowser.liveDebuggerFullscreenUrl ||
        conversationActiveBrowser.liveDebuggerUrl ||
        conversationActiveBrowser.liveViewUrl ||
        conversationActiveBrowser.vncUrl) as string,
      currentUrl: undefined,
      title: undefined,
    }
  }

  return null
}
