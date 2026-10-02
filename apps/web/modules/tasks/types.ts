export type TaskStatus = "pending" | "in_progress" | "completed" | "failed";

export type TaskItem = {
  id: string;
  agentId: string;
  input?: string;
  status: TaskStatus | string;
  result?: unknown;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export interface CreateTaskInput {
  agentId: string;
  input: string;
}
