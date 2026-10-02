export type RunStatus =
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";

export type RunRecord = {
  id: string;
  userId: string;
  agentId: string;
  conversationId: string | null;
  status: RunStatus;
  triggerType: string;
  input: unknown;
  output: unknown;
  error: string | null;
  startedAt: string | Date | null;
  completedAt: string | Date | null;
  createdAt: string | Date;
};

export type StepItem = {
  id?: string;
  stepNumber: number;
  type: "model" | "tool";
  status: "running" | "completed" | "failed";
  toolName?: string | null;
  toolCallId?: string | null;
  toolInput?: unknown;
  toolOutput?: unknown;
  startedAt?: string | Date | null;
  completedAt?: string | Date | null;
};
