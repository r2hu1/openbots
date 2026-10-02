export type Agent = {
  id: string;
  name: string;
  description: string | null;
  instructions: string;
  model: string;
  maxSteps: number;
  autonomy: string;
  status: string;
};

export type AgentTool = {
  id: string;
  agentId: string;
  toolName: string;
  provider: "internal" | "composio" | "mcp";
  enabled: boolean;
  config: unknown;
};

export type AvailableModel = {
  id: string;
  displayName: string;
  description?: string;
};

export interface CreateAgentInput {
  name: string;
  description?: string;
  instructions: string;
  model: string;
  maxSteps: number;
  autonomy?: "manual";
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  instructions?: string;
  model?: string;
  maxSteps?: number;
}
