import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
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
        query: {},
      });
      if (!res.ok) return { conversation: null, messages: [] };
      return (await res.json()) as {
        conversation: Conversation;
        messages: MessageItem[];
        pagination?: {
          nextCursor: string | null;
          hasMore: boolean;
          limit: number;
        };
      };
    },
    enabled: Boolean(conversationId),
    refetchInterval: options?.refetchInterval ?? false,
    placeholderData: (prev) => prev,
  });
}

export function useInfiniteConversationDetailQuery(
  conversationId: string | null | undefined,
  options?: {
    refetchInterval?: number | false;
  },
) {
  return useInfiniteQuery({
    queryKey: conversationKeys.detail(conversationId),
    queryFn: async ({ pageParam }) => {
      if (!conversationId) {
        return {
          conversation: null,
          messages: [],
          pagination: { nextCursor: null, hasMore: false, limit: 50 },
        };
      }
      const client = getClient();
      const res = await client.api.conversations[":id"].$get({
        param: { id: conversationId },
        query: pageParam ? { before: pageParam } : {},
      });
      if (!res.ok) {
        return {
          conversation: null,
          messages: [],
          pagination: { nextCursor: null, hasMore: false, limit: 50 },
        };
      }
      return (await res.json()) as {
        conversation: Conversation;
        messages: MessageItem[];
        pagination?: {
          nextCursor: string | null;
          hasMore: boolean;
          limit: number;
        };
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage?.pagination?.hasMore && lastPage.pagination.nextCursor) {
        return lastPage.pagination.nextCursor;
      }
      return undefined;
    },
    enabled: Boolean(conversationId),
    refetchInterval: options?.refetchInterval ?? false,
  });
}

export type TimelineSearchResult = {
  messageId: string;
  conversationId: string;
  role: string;
  text: string;
  createdAt: string;
  agentId: string;
  conversationTitle?: string | null;
};

export function useTimelineSearchQuery(query: string, enabled: boolean = true) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["timeline-search", trimmed],
    queryFn: async () => {
      if (!trimmed || trimmed.length < 2) return [];
      const client = getClient();
      const res = await (client.api.conversations as any).search.$get({
        query: { q: trimmed, limit: "15" },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { results: TimelineSearchResult[] };
      return data.results || [];
    },
    enabled: enabled && trimmed.length >= 2,
    staleTime: 30_000,
  });
}

export function useToggleMessageReactionMutation(
  conversationId?: string | null,
) {
  return useMutation({
    mutationFn: async ({
      messageId,
      emoji,
    }: {
      messageId: string;
      emoji: string;
    }) => {
      const client = getClient();
      const res = await (client.api.conversations as any).messages[
        ":messageId"
      ].reaction.$post({
        param: { messageId },
        json: { emoji },
      });
      if (!res.ok) throw new Error("Failed to toggle reaction");
      return (await res.json()) as {
        success: boolean;
        messageId: string;
        reactions: string[];
      };
    },
  });
}

export function useUploadConversationImageMutation() {
  return useMutation({
    mutationFn: async (file: File) => {
      const client = getClient();
      const res = await (client.api.conversations as any).upload.$post({
        form: { file },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to upload image");
      }

      return (await res.json()) as {
        success: boolean;
        url: string;
        path: string;
      };
    },
  });
}

export function useDeleteConversationImageMutation() {
  return useMutation({
    mutationFn: async (path: string) => {
      const client = getClient();
      const res = await (client.api.conversations as any).upload.$delete({
        json: { path },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete image");
      }

      return (await res.json()) as {
        success: boolean;
        path: string;
      };
    },
  });
}
