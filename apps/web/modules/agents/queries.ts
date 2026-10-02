import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getClient } from "@/lib/api";
import type {
  Agent,
  AgentTool,
  AvailableModel,
  CreateAgentInput,
  UpdateAgentInput,
} from "./types";

export const agentKeys = {
  all: ["agents"] as const,
  detail: (id: string | null | undefined) => ["agent", id] as const,
  models: ["available-models"] as const,
  tools: (agentId: string | null | undefined) =>
    ["agent-tools", agentId] as const,
};

export function useAgentsQuery() {
  return useQuery({
    queryKey: agentKeys.all,
    queryFn: async () => {
      const client = getClient();
      const res = await client.api.agents.$get();
      if (!res.ok) {
        throw new Error("Failed to fetch agents");
      }
      const data = (await res.json()) as { agents: Agent[] };
      return data.agents;
    },
  });
}

export function useAgentQuery(id: string | null | undefined) {
  return useQuery({
    queryKey: agentKeys.detail(id),
    queryFn: async () => {
      if (!id) return null;
      const client = getClient();
      const res = await client.api.agents[":id"].$get({
        param: { id },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch agent");
      }
      const data = (await res.json()) as { agent: Agent };
      return data.agent;
    },
    enabled: Boolean(id),
  });
}

export function useAvailableModelsQuery(enabled = true) {
  return useQuery({
    queryKey: agentKeys.models,
    queryFn: async () => {
      const client = getClient();
      const res = await client.api.agents.models.$get();
      if (!res.ok) return [];
      const data = (await res.json()) as { models: AvailableModel[] };
      return data.models;
    },
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useAgentToolsQuery(
  agentId: string | null | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: agentKeys.tools(agentId),
    queryFn: async () => {
      if (!agentId) return [];
      const client = getClient();
      const res = await client.api.agents[":id"].tools.$get({
        param: { id: agentId },
      });
      if (!res.ok) throw new Error("Failed to fetch tools");
      const data = (await res.json()) as { tools: AgentTool[] };
      return data.tools;
    },
    enabled: enabled && Boolean(agentId),
  });
}

export function useCreateAgentMutation(options?: {
  onSuccess?: (agentId: string) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAgentInput) => {
      const client = getClient();
      const res = await client.api.agents.$post({
        json: {
          name: input.name.trim(),
          description: input.description?.trim() || undefined,
          instructions: input.instructions.trim(),
          model: input.model,
          maxSteps: Number(input.maxSteps) || 10,
          autonomy: input.autonomy || "manual",
        },
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data?.error || "Failed to create agent");
      }

      return (await res.json()) as { agent: { id: string } };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.all });
      if (data?.agent?.id) {
        options?.onSuccess?.(data.agent.id);
      }
    },
  });
}

export function useUpdateAgentMutation(agentId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateAgentInput) => {
      if (!agentId) throw new Error("No agent selected");
      const client = getClient();
      const res = await client.api.agents[":id"].$patch({
        param: { id: agentId },
        json: {
          name: input.name?.trim(),
          description: input.description?.trim() || undefined,
          instructions: input.instructions?.trim(),
          model: input.model,
          maxSteps: input.maxSteps ? Number(input.maxSteps) : undefined,
        },
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data?.error || "Failed to update agent");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.all });
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(agentId) });
    },
  });
}

export function useDeleteAgentMutation(agentId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!agentId) throw new Error("No agent selected");
      const client = getClient();
      const res = await client.api.agents[":id"].$delete({
        param: { id: agentId },
      });
      if (!res.ok) throw new Error("Failed to delete agent");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}

export function useToggleAgentToolMutation(agentId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      toolName,
      provider,
      enabled,
    }: {
      toolName: string;
      provider: "internal" | "composio" | "mcp";
      enabled: boolean;
    }) => {
      if (!agentId) throw new Error("No agent selected");
      const client = getClient();
      const res = await client.api.agents[":id"].tools.$post({
        param: { id: agentId },
        json: { toolName, provider, enabled },
      });
      if (!res.ok) throw new Error("Failed to update tool");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.tools(agentId) });
    },
  });
}
