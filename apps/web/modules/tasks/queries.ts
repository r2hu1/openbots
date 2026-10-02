import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getClient } from "@/lib/api";
import type { CreateTaskInput, TaskItem } from "./types";

export const taskKeys = {
  all: ["tasks"] as const,
  detail: (id: string | null | undefined) => ["task", id] as const,
};

export function useTasksQuery() {
  return useQuery({
    queryKey: taskKeys.all,
    queryFn: async () => {
      const client = getClient();
      const res = await client.api.tasks.$get();
      if (!res.ok) throw new Error("Failed to fetch tasks");
      const data = (await res.json()) as { tasks: TaskItem[] };
      return data.tasks;
    },
  });
}

export function useTaskDetailQuery(id: string | null | undefined) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: async () => {
      if (!id) return null;
      const client = getClient();
      const res = await client.api.tasks[":id"].$get({
        param: { id },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { task: TaskItem };
      return data.task;
    },
    enabled: Boolean(id),
  });
}

export function useCreateTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTaskInput) => {
      const client = getClient();
      const res = await client.api.tasks.$post({
        json: data,
      });
      if (!res.ok) throw new Error("Failed to create task");
      const resData = (await res.json()) as { task: TaskItem };
      return resData.task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
