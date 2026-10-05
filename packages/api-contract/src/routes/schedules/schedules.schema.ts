import { z } from "zod";

export const createScheduleInputSchema = z.object({
  agentId: z.string().uuid(),
  name: z.string().min(1),
  prompt: z.string().min(1),
  cronExpression: z.string().min(1),
  timezone: z.string().optional().default("UTC"),
});

export const updateScheduleInputSchema = z.object({
  name: z.string().min(1).optional(),
  prompt: z.string().min(1).optional(),
  cronExpression: z.string().min(1).optional(),
  timezone: z.string().optional(),
  status: z.enum(["active", "paused"]).optional(),
});

export type CreateScheduleInput = z.infer<typeof createScheduleInputSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleInputSchema>;
