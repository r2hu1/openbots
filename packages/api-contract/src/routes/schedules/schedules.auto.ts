import { db, agents } from "@openbots/db";
import { and, eq } from "drizzle-orm";
import { createSchedule } from "./schedules.logic.js";
import {
  fallbackParseSchedulePrompt,
  getNaturalScheduleParser,
} from "./schedules.natural.js";
import type { CreateNaturalScheduleInput } from "./schedules.schema.js";

export async function createAutoScheduleForAgent(
  userId: string,
  agentId: string,
  data: CreateNaturalScheduleInput,
) {
  const [agent] = await db
    .select({
      id: agents.id,
      model: agents.model,
    })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, userId)));

  if (!agent) {
    return { error: "Agent not found or unauthorized", status: 404 as const };
  }

  const parser = getNaturalScheduleParser();
  let parsed = null;

  if (parser) {
    try {
      parsed = await parser({
        userId,
        model: agent.model,
        prompt: data.prompt,
        timezone: data.timezone,
      });
    } catch (err) {
      console.warn("Custom schedule parser failed, using fallback:", err);
    }
  }

  if (!parsed) {
    parsed = fallbackParseSchedulePrompt(data.prompt);
  }

  const result = await createSchedule(userId, {
    agentId,
    name: parsed.name,
    prompt: parsed.prompt,
    cronExpression: parsed.cronExpression,
    timezone: data.timezone || "UTC",
  });

  return { schedule: result.schedule };
}
