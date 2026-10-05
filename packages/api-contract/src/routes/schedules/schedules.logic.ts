import { db, runs, schedules } from "@openbots/db";
import { schedules as triggerSchedules } from "@trigger.dev/sdk";
import { and, desc, eq } from "drizzle-orm";
import type { CreateScheduleInput, UpdateScheduleInput } from "./schedules.schema.js";

export async function listSchedules(userId: string, agentId?: string) {
  const whereClause = agentId
    ? and(eq(schedules.userId, userId), eq(schedules.agentId, agentId))
    : eq(schedules.userId, userId);

  const items = await db
    .select()
    .from(schedules)
    .where(whereClause)
    .orderBy(desc(schedules.createdAt));

  return { schedules: items };
}

export async function getSchedule(id: string, userId: string) {
  const [schedule] = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.id, id), eq(schedules.userId, userId)));

  return schedule ?? null;
}

export async function createSchedule(userId: string, data: CreateScheduleInput) {
  const [inserted] = await db
    .insert(schedules)
    .values({
      userId,
      agentId: data.agentId,
      name: data.name,
      prompt: data.prompt,
      cronExpression: data.cronExpression,
      timezone: data.timezone ?? "UTC",
      status: "active",
    })
    .returning();

  if (!inserted) {
    throw new Error("Failed to create schedule in database");
  }

  // Register with Trigger.dev dynamic schedules
  try {
    const triggerSched = await triggerSchedules.create({
      task: "scheduled-agent-task",
      cron: data.cronExpression,
      timezone: data.timezone ?? "UTC",
      deduplicationKey: inserted.id,
      externalId: inserted.id,
    });

    if (triggerSched?.id) {
      await db
        .update(schedules)
        .set({ triggerScheduleId: triggerSched.id })
        .where(eq(schedules.id, inserted.id));
      inserted.triggerScheduleId = triggerSched.id;
    }
  } catch (err) {
    console.warn("Could not register recurring schedule with Trigger.dev:", err);
  }

  return { schedule: inserted };
}

export async function updateSchedule(
  id: string,
  userId: string,
  data: UpdateScheduleInput,
) {
  const existing = await getSchedule(id, userId);
  if (!existing) return null;

  const [updated] = await db
    .update(schedules)
    .set({
      ...(data.name ? { name: data.name } : {}),
      ...(data.prompt ? { prompt: data.prompt } : {}),
      ...(data.cronExpression ? { cronExpression: data.cronExpression } : {}),
      ...(data.timezone ? { timezone: data.timezone } : {}),
      ...(data.status ? { status: data.status } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(schedules.id, id), eq(schedules.userId, userId)))
    .returning();

  if (!updated) return null;

  // Sync state with Trigger.dev
  if (existing.triggerScheduleId) {
    try {
      if (data.status === "paused") {
        await triggerSchedules.deactivate(existing.triggerScheduleId);
      } else if (data.status === "active") {
        await triggerSchedules.activate(existing.triggerScheduleId);
      }

      if (data.cronExpression || data.timezone) {
        await triggerSchedules.update(existing.triggerScheduleId, {
          task: "scheduled-agent-task",
          cron: data.cronExpression ?? existing.cronExpression,
          timezone: data.timezone ?? existing.timezone,
        });
      }
    } catch (err) {
      console.warn("Could not sync schedule update with Trigger.dev:", err);
    }
  }

  return { schedule: updated };
}

export async function deleteSchedule(id: string, userId: string) {
  const existing = await getSchedule(id, userId);
  if (!existing) return null;

  if (existing.triggerScheduleId) {
    try {
      await triggerSchedules.del(existing.triggerScheduleId);
    } catch (err) {
      console.warn("Could not delete Trigger.dev schedule:", err);
    }
  }

  const [deleted] = await db
    .delete(schedules)
    .where(and(eq(schedules.id, id), eq(schedules.userId, userId)))
    .returning();

  return deleted ? { schedule: deleted } : null;
}
