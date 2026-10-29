"use client"

import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { useAgentExecution } from "@/modules/agents/hooks/use-agent-execution"
import { useReconciledMessages } from "@/modules/conversations/hooks/use-reconciled-messages"
import {
  useConversationsQuery,
  useInfiniteConversationDetailQuery,
  useToggleMessageReactionMutation,
} from "@/modules/conversations/queries"

interface UseWorkspaceChatProps {
  agentId: string
}

export function useWorkspaceChat({ agentId }: UseWorkspaceChatProps) {
  const [selectedConversationId, setSelectedConversationId] = React.useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get("conversationId")
    }
    return null
  })

  const { data: conversationsData, isLoading: isLoadingConversations } = useConversationsQuery(agentId)
  const conversations = React.useMemo(() => conversationsData ?? [], [conversationsData])

  const activeConversationId = selectedConversationId ?? conversations[0]?.id ?? null

  const execution = useAgentExecution({
    agentId,
    activeConversationId,
    onConversationCreated: setSelectedConversationId,
  })

  React.useEffect(() => {
    const handleNavigate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        agentId: string
        conversationId?: string
        messageId?: string
      }>
      if (customEvent.detail?.agentId === agentId && customEvent.detail?.conversationId) {
        setSelectedConversationId(customEvent.detail.conversationId)
      }
    }

    const handleSendPrompt = (event: Event) => {
      const customEvent = event as CustomEvent<{
        prompt: string
      }>
      if (customEvent.detail?.prompt) {
        execution.sendPrompt(customEvent.detail.prompt)
      }
    }

    window.addEventListener("openbots:navigate-message", handleNavigate)
    window.addEventListener("openbots:send-prompt", handleSendPrompt)
    return () => {
      window.removeEventListener("openbots:navigate-message", handleNavigate)
      window.removeEventListener("openbots:send-prompt", handleSendPrompt)
    }
  }, [agentId, execution.sendPrompt])

  const {
    data: conversationInfiniteData,
    isLoading: isLoadingMessages,
    isFetchingNextPage: isLoadingOlder,
    hasNextPage: hasOlderMessages,
    fetchNextPage,
  } = useInfiniteConversationDetailQuery(activeConversationId, {
    refetchInterval: false,
  })

  const serverMessages = React.useMemo(() => {
    if (!conversationInfiniteData?.pages) return []
    const pages = [...conversationInfiniteData.pages].reverse()
    return pages.flatMap((p) => p.messages ?? [])
  }, [conversationInfiniteData?.pages])

  const clearOptimistic = React.useCallback(
    () => execution.setOptimisticMessages([]),
    [execution.setOptimisticMessages]
  )

  const messages = useReconciledMessages({
    serverMessages,
    optimisticMessages: execution.optimisticMessages,
    activeRun: execution.activeRun,
    activeConversationId,
    onClearOptimistic: clearOptimistic,
  })

  const queryClient = useQueryClient()
  const toggleReactionMutation = useToggleMessageReactionMutation(activeConversationId)

  const handleToggleReaction = React.useCallback(
    (messageId: string, emoji: string) => {
      toggleReactionMutation.mutate(
        { messageId, emoji },
        {
          onSuccess: () => {
            if (activeConversationId) {
              queryClient.invalidateQueries({
                queryKey: ["conversation", activeConversationId],
              })
            }
          },
        }
      )
    },
    [activeConversationId, toggleReactionMutation, queryClient]
  )

  const isChatLoading =
    !execution.isOptimisticRunning &&
    execution.optimisticMessages.length === 0 &&
    (isLoadingConversations || (activeConversationId !== null && isLoadingMessages))

  return {
    activeConversationId,
    execution,
    conversationInfiniteData,
    messages,
    isLoadingOlder,
    hasOlderMessages,
    fetchNextPage,
    handleToggleReaction,
    isChatLoading,
  }
}
