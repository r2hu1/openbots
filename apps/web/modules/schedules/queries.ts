import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getClient } from "@/lib/api";
import type {
  CreateNaturalScheduleInput,
  CreateScheduleInput,
  ScheduleItem,
  UpdateScheduleInput,
} from "./types";

export const scheduleKeys = {
  all: ["schedules"] as const,
  byAgent: (agentId: string | null | undefined) =>
    ["schedules", agentId] as const,
  detail: (id: string | null | undefined) => ["schedule", id] as const,
};

export function useSchedulesQuery(
  agentId: string | null | undefined,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  },
) {
  return useQuery({
    queryKey: scheduleKeys.byAgent(agentId),
    queryFn: async () => {
      if (!agentId) return [];
      const client = getClient();
      const res = await (client.api as any).schedules.$get({
        query: { agentId },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { schedules: ScheduleItem[] };
      return data.schedules;
    },
    enabled: (options?.enabled ?? true) && Boolean(agentId),
    refetchInterval: options?.refetchInterval ?? false,
  });
}

export function useCreateScheduleMutation(agentId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateScheduleInput) => {
      const client = getClient();
      const res = await (client.api as any).schedules.$post({
        json: input,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create schedule");
      }
      return (await res.json()) as { schedule: ScheduleItem };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      if (agentId) {
        queryClient.invalidateQueries({
          queryKey: scheduleKeys.byAgent(agentId),
        });
      }
    },
  });
}

export function useCreateAutoScheduleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      agentId,
      ...input
    }: CreateNaturalScheduleInput & { agentId: string }) => {
      const client = getClient();
      const res = await (client.api as any).schedules.agents[":agentId"].auto.$post({
        param: { agentId },
        json: input,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create scheduled task");
      }
      return (await res.json()) as { schedule: ScheduleItem };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      if (variables.agentId) {
        queryClient.invalidateQueries({
          queryKey: scheduleKeys.byAgent(variables.agentId),
        });
      }
    },
  });
}

export function useUpdateScheduleMutation(agentId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateScheduleInput;
    }) => {
      const client = getClient();
      const res = await (client.api as any).schedules[":id"].$patch({
        param: { id },
        json: data,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update schedule");
      }
      return (await res.json()) as { schedule: ScheduleItem };
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      if (agentId) {
        queryClient.invalidateQueries({
          queryKey: scheduleKeys.byAgent(agentId),
        });
      }
    },
  });
}

export function useDeleteScheduleMutation(agentId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const client = getClient();
      const res = await (client.api as any).schedules[":id"].$delete({
        param: { id },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete schedule");
      }
      return (await res.json()) as { schedule: ScheduleItem };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      if (agentId) {
        queryClient.invalidateQueries({
          queryKey: scheduleKeys.byAgent(agentId),
        });
      }
    },
  });
}
