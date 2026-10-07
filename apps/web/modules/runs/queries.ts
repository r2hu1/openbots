import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getClient } from "@/lib/api";
import type { RunRecord, StepItem } from "./types";

export const runKeys = {
  all: ["runs"] as const,
  byAgent: (agentId: string | null | undefined) => ["runs", agentId] as const,
  detail: (runId: string | null | undefined) => ["run", runId] as const,
};

export function useRunsQuery(
  agentId: string | null | undefined,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  },
) {
  return useQuery({
    queryKey: runKeys.byAgent(agentId),
    queryFn: async () => {
      if (!agentId) return [];
      const client = getClient();
      const res = await client.api.runs.$get({
        query: { agentId },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { runs: RunRecord[] };
      return data.runs;
    },
    enabled: (options?.enabled ?? true) && Boolean(agentId),
    refetchInterval: options?.refetchInterval ?? false,
  });
}

export function useRunDetailQuery(
  runId: string | null | undefined,
  options?: {
    enabled?: boolean;
    refetchInterval?:
      | number
      | false
      | ((query: {
          state: { data?: { run: RunRecord; steps: StepItem[] } | null };
        }) => number | false);
  },
) {
  return useQuery({
    queryKey: runKeys.detail(runId),
    queryFn: async () => {
      if (!runId) return null;
      const client = getClient();
      const res = await client.api.runs[":id"].$get({
        param: { id: runId },
      });
      if (!res.ok) throw new Error("Failed to fetch run details");
      return (await res.json()) as { run: RunRecord; steps: StepItem[] };
    },
    enabled: (options?.enabled ?? true) && Boolean(runId),
    refetchInterval: options?.refetchInterval ?? false,
  });
}

export function useCancelRunMutation(agentId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runId: string) => {
      const client = getClient();
      const res = await client.api.runs[":id"].cancel.$post({
        param: { id: runId },
      });
      if (!res.ok) throw new Error("Failed to cancel run");
      return res.json();
    },
    onSuccess: (_, runId) => {
      queryClient.invalidateQueries({ queryKey: runKeys.detail(runId) });
      if (agentId) {
        queryClient.invalidateQueries({ queryKey: runKeys.byAgent(agentId) });
      }
    },
  });
}

export function useTriggerAgentRunMutation(
  agentId: string | null | undefined,
  activeConversationId?: string | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      prompt,
      images,
      conversationId,
    }: {
      prompt: string;
      images?: string[];
      conversationId?: string | null;
    }) => {
      if (!agentId) throw new Error("No agent selected");
      const client = getClient();
      const res = await client.api.agents[":id"].runs.$post({
        param: { id: agentId },
        json: {
          prompt,
          images: images && images.length > 0 ? images : undefined,
          conversationId: conversationId || undefined,
        },
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data?.error || "Failed to trigger run");
      }

      return (await res.json()) as {
        run: {
          id: string;
          status: RunRecord["status"];
          conversationId?: string | null;
        };
      };
    },
    onSuccess: (data) => {
      const convId = data.run.conversationId || activeConversationId;
      if (convId) {
        queryClient.invalidateQueries({
          queryKey: ["conversation", convId],
        });
      }
      if (agentId) {
        queryClient.invalidateQueries({ queryKey: runKeys.byAgent(agentId) });
        queryClient.invalidateQueries({
          queryKey: ["conversations", agentId],
        });
      }
    },
  });
}
