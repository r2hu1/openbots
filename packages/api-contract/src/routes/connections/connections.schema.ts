import { z } from "zod";

export const ConnectionStatus = {
  ACTIVE: "active",
  DISCONNECTED: "disconnected",
  ERROR: "error",
} as const;

export type ConnectionStatus =
  (typeof ConnectionStatus)[keyof typeof ConnectionStatus];

export const createConnectionSchema = z.object({
  provider: z.string().min(1),
  externalAccountId: z.string().min(1),
  metadata: z.any().optional(),
});

export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;

export const initiateConnectionSchema = z.object({
  appName: z.string().min(1),
});

export type InitiateConnectionInput = z.infer<typeof initiateConnectionSchema>;
