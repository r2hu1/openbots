import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getClient } from "@/lib/api";
import type { Connection } from "./types";

export const connectionKeys = {
  all: ["connections"] as const,
};

export function useConnectionsQuery(options?: {
  enabled?: boolean;
  refetchInterval?: number | false;
}) {
  return useQuery({
    queryKey: connectionKeys.all,
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval ?? false,
    queryFn: async () => {
      const client = getClient();
      const response = await client.api.connections.$get();

      if (!response.ok) {
        throw new Error("Failed to load connections");
      }

      const data = (await response.json()) as {
        connections: Connection[];
      };
      return data.connections;
    },
  });
}

export function useInitiateConnectionMutation() {
  return useMutation({
    mutationFn: async ({ appName }: { appName: string }) => {
      const client = getClient();
      const response = await client.api.connections.initiate.$post({
        json: { appName },
      });

      if (!response.ok) {
        throw new Error("Failed to initiate connection");
      }

      return response.json() as Promise<{
        redirectUrl: string;
      }>;
    },
  });
}

export function useDeleteConnectionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const client = getClient();
      const response = await client.api.connections[":id"].$delete({
        param: { id },
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect integration");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: connectionKeys.all,
      });
    },
  });
}
