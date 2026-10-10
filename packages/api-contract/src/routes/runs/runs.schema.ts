import { z } from "zod";

export const RunStatus = {
  QUEUED: "queued",
  RUNNING: "running",
  WAITING: "waiting",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

export const hitlSchema = z.object({
  action: z.enum(["completed", "skipped"]).default("completed"),
  notes: z.string().optional(),
  contextKey: z.string().optional(),
});

export type HitlInput = z.infer<typeof hitlSchema>;
