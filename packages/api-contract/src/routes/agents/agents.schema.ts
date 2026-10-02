import { z } from "zod";

export const createAgentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  instructions: z.string().min(1).default("You are a helpful assistant."),
  model: z.string().default("google/gemini-2.5-flash"),
  maxSteps: z.number().int().min(1).max(100).default(25),
  autonomy: z.enum(["manual", "approved", "autonomous"]).default("manual"),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;

export const updateAgentSchema = createAgentSchema.partial();
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;

export const configureToolSchema = z.object({
  toolName: z.string().min(1),
  provider: z.enum(["internal", "composio", "mcp"]),
  enabled: z.boolean(),
  config: z.any().optional(),
});
export type ConfigureToolInput = z.infer<typeof configureToolSchema>;

export const createAgentRunSchema = z.object({
  prompt: z.string().optional(),
  input: z.any().optional(),
  conversationId: z.string().uuid().optional(),
});

export type CreateAgentRunInput = z.infer<typeof createAgentRunSchema>;
