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

export const conversationAttachmentSchema = z.object({
  url: z.string().url(),
  path: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().optional(),
});
export type ConversationAttachment = z.infer<typeof conversationAttachmentSchema>;

export const createAgentRunSchema = z.object({
  prompt: z.string().optional(),
  images: z.array(z.string().url()).max(10).optional(),
  attachments: z.array(conversationAttachmentSchema).max(10).optional(),
  input: z.any().optional(),
  conversationId: z.string().uuid().optional(),
  clientContext: z
    .object({
      timezone: z.string().optional(),
      localTime: z.string().optional(),
      locale: z.string().optional(),
      city: z.string().optional(),
      region: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
});

export type CreateAgentRunInput = z.infer<typeof createAgentRunSchema>;

