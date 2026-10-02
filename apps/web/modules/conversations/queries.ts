import { useQuery } from "@tanstack/react-query";
import { getClient } from "@/lib/api";
import type { Conversation, MessageItem } from "./types";

export const conversationKeys = {
  all: ["conversations"] as const,
  byAgent: (agentId: string | null | undefined) =>
    ["conversations", agentId] as const,
  detail: (conversationId: string | null | undefined) =>
    ["conversation", conversationId] as const,
};

export function useConversationsQuery(agentId: string | null | undefined) {
  return useQuery({
    queryKey: conversationKeys.byAgent(agentId),
    queryFn: async () => {
      if (!agentId) return [];
      const client = getClient();
      const res = await client.api.conversations.$get({
        query: { agentId },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { conversations: Conversation[] };
      return data.conversations;
    },
    enabled: Boolean(agentId),
  });
}

export function useConversationDetailQuery(
  conversationId: string | null | undefined,
  options?: {
    refetchInterval?: number | false;
  },
) {
  return useQuery({
    queryKey: conversationKeys.detail(conversationId),
    queryFn: async () => {
      if (!conversationId) return { conversation: null, messages: [] };
      const client = getClient();
      const res = await client.api.conversations[":id"].$get({
        param: { id: conversationId },
      });
      if (!res.ok) return { conversation: null, messages: [] };
      return (await res.json()) as {
        conversation: Conversation;
        messages: MessageItem[];
      };
    },
    enabled: Boolean(conversationId),
    refetchInterval: options?.refetchInterval ?? false,
    placeholderData: (prev) => prev,
  });
}
