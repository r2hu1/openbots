"use client"

import * as React from "react"
import type { MessageItem } from "../types"

interface UseConversationScrollOptions {
  messages: MessageItem[]
  isLoading: boolean
  hasOlderMessages: boolean
  isLoadingOlder: boolean
  onLoadOlderMessages?: () => void
}

export function useConversationScroll({
  messages,
  isLoading,
  hasOlderMessages,
  isLoadingOlder,
  onLoadOlderMessages,
}: UseConversationScrollOptions) {
  const topSentinelRef = React.useRef<HTMLDivElement>(null)
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const isFetchingOlderRef = React.useRef(false)
  const prevScrollHeightRef = React.useRef<number | null>(null)
  const prevScrollTopRef = React.useRef<number | null>(null)

  // Track fetching state
  React.useEffect(() => {
    isFetchingOlderRef.current = isLoadingOlder
  }, [isLoadingOlder])

  // Trigger loading older messages safely
  const triggerLoadOlder = React.useCallback(() => {
    if (
      !hasOlderMessages ||
      isLoadingOlder ||
      isFetchingOlderRef.current ||
      !onLoadOlderMessages
    ) {
      return
    }

    const viewport =
      viewportRef.current ||
      topSentinelRef.current?.closest<HTMLElement>(
        "[data-slot='message-scroller-viewport']"
      )

    if (viewport) {
      prevScrollHeightRef.current = viewport.scrollHeight
      prevScrollTopRef.current = viewport.scrollTop
    }

    isFetchingOlderRef.current = true
    onLoadOlderMessages()
  }, [hasOlderMessages, isLoadingOlder, onLoadOlderMessages])

  // Preserve scroll position when older messages prepend
  React.useLayoutEffect(() => {
    if (prevScrollHeightRef.current !== null && !isLoadingOlder) {
      const viewport =
        viewportRef.current ||
        topSentinelRef.current?.closest<HTMLElement>(
          "[data-slot='message-scroller-viewport']"
        )

      if (viewport) {
        const heightDiff = viewport.scrollHeight - prevScrollHeightRef.current
        if (heightDiff > 0 && prevScrollTopRef.current !== null) {
          viewport.scrollTop = prevScrollTopRef.current + heightDiff
        }
      }
      prevScrollHeightRef.current = null
      prevScrollTopRef.current = null
    }
  }, [messages.length, isLoadingOlder])

  // IntersectionObserver to auto-fetch when scrolling near the top
  React.useEffect(() => {
    if (!hasOlderMessages || isLoadingOlder || !onLoadOlderMessages) return

    const sentinel = topSentinelRef.current
    if (!sentinel) return

    const scrollContainer =
      sentinel.closest<HTMLElement>(
        "[data-slot='message-scroller-viewport']"
      ) || sentinel.parentElement

    if (!scrollContainer) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (
          entry?.isIntersecting &&
          scrollContainer.scrollTop <= 80 &&
          scrollContainer.scrollHeight > scrollContainer.clientHeight
        ) {
          triggerLoadOlder()
        }
      },
      {
        root: scrollContainer,
        rootMargin: "100px 0px 0px 0px",
        threshold: 0.1,
      }
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [hasOlderMessages, isLoadingOlder, onLoadOlderMessages, triggerLoadOlder])

  // Resilient scroll fallback
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    if (
      hasOlderMessages &&
      !isLoadingOlder &&
      !isFetchingOlderRef.current &&
      target.scrollTop <= 60 &&
      target.scrollHeight > target.clientHeight
    ) {
      triggerLoadOlder()
    }
  }

  // Scroll to targeted message if URL hash is present
  const targetMessageIdRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (typeof window === "undefined") return

    const updateTargetFromHash = () => {
      const hash = window.location.hash
      if (hash && hash.startsWith("#message-")) {
        targetMessageIdRef.current = hash.slice(1)
      }
    }

    const handleNavigate = (event: Event) => {
      const customEvent = event as CustomEvent<{ messageId?: string }>
      if (customEvent.detail?.messageId) {
        targetMessageIdRef.current = `message-${customEvent.detail.messageId}`
      }
    }

    updateTargetFromHash()
    window.addEventListener("hashchange", updateTargetFromHash)
    window.addEventListener("openbots:navigate-message", handleNavigate)

    return () => {
      window.removeEventListener("hashchange", updateTargetFromHash)
      window.removeEventListener("openbots:navigate-message", handleNavigate)
    }
  }, [])

  React.useEffect(() => {
    if (isLoading) return
    const targetId = targetMessageIdRef.current
    if (!targetId) return

    const el = document.getElementById(targetId)
    if (el) {
      const viewport =
        viewportRef.current ||
        topSentinelRef.current?.closest<HTMLElement>(
          "[data-slot='message-scroller-viewport']"
        )

      if (viewport) {
        const viewportRect = viewport.getBoundingClientRect()
        const elRect = el.getBoundingClientRect()
        const relativeTop = elRect.top - viewportRect.top
        const targetScrollTop =
          viewport.scrollTop +
          relativeTop -
          (viewport.clientHeight - elRect.height) / 2

        viewport.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: "smooth",
        })
      } else {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      }

      el.classList.add("ring-2", "ring-primary/50", "rounded-xl", "transition-all")
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary/50")
      }, 2500)
      targetMessageIdRef.current = null

      if (typeof window !== "undefined" && window.history.replaceState) {
        const cleanUrl = window.location.pathname
        window.history.replaceState(null, "", cleanUrl)
      }
      return
    }

    if (
      hasOlderMessages &&
      !isLoadingOlder &&
      !isFetchingOlderRef.current &&
      onLoadOlderMessages
    ) {
      triggerLoadOlder()
    } else if (!hasOlderMessages && !isLoadingOlder) {
      targetMessageIdRef.current = null
    }
  }, [
    isLoading,
    messages.length,
    hasOlderMessages,
    isLoadingOlder,
    onLoadOlderMessages,
    triggerLoadOlder,
  ])

  return {
    topSentinelRef,
    viewportRef,
    handleScroll,
  }
}
