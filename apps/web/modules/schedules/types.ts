export interface ScheduleItem {
  id: string;
  userId: string;
  agentId: string;
  name: string;
  prompt: string;
  cronExpression: string;
  timezone: string;
  triggerScheduleId?: string | null;
  status: "active" | "paused";
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleInput {
  agentId: string;
  name: string;
  prompt: string;
  cronExpression: string;
  timezone?: string;
}

export interface UpdateScheduleInput {
  name?: string;
  prompt?: string;
  cronExpression?: string;
  timezone?: string;
  status?: "active" | "paused";
}
