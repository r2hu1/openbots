import { db, runs, schedules } from "@openbots/db";
import { schedules as triggerSchedules } from "@trigger.dev/sdk";
import { and, desc, eq } from "drizzle-orm";
import { agentEventHub } from "../runs/runs.logic.js";
import type {
  CreateScheduleInput,
  UpdateScheduleInput,
} from "./schedules.schema.js";

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

/**
 * Comprehensive timezone normalization map.
 * Trigger.dev strictly validates IANA timezones using canonical Olson / IANA zone names.
 * This normalizes:
 * - Deprecated/renamed IANA aliases (e.g. Asia/Kolkata -> Asia/Calcutta, Asia/Saigon -> Asia/Ho_Chi_Minh)
 * - Standard 3-letter & military abbreviations (IST, PST, PDT, EST, EDT, CST, CDT, MST, MDT, GMT, BST, JST, KST, AEST, AEDT, CET, CEST, UTC, etc.)
 * - Country / regional aliases ('india', 'japan', 'uk', 'vietnam')
 * - Fixed UTC/GMT offsets ('UTC+5:30', 'GMT-5', '+05:30', '-08:00')
 */
const TIMEZONE_CANONICAL_MAP: Record<string, string> = {
  // India / South Asia
  "asia/kolkata": "Asia/Calcutta",
  ist: "Asia/Calcutta",
  india: "Asia/Calcutta",
  "asia/kathmandu": "Asia/Katmandu",
  npt: "Asia/Katmandu",
  nepal: "Asia/Katmandu",

  // UTC / GMT / Western Europe
  utc: "UTC",
  gmt: "UTC",
  "etc/gmt": "UTC",
  "etc/utc": "UTC",
  z: "UTC",
  wet: "Europe/London",
  west: "Europe/London",
  bst: "Europe/London",
  uk: "Europe/London",
  "europe/belfast": "Europe/London",

  // US & Canada
  est: "America/New_York",
  edt: "America/New_York",
  et: "America/New_York",
  "us/eastern": "America/New_York",
  cst: "America/Chicago",
  cdt: "America/Chicago",
  ct: "America/Chicago",
  "us/central": "America/Chicago",
  mst: "America/Denver",
  mdt: "America/Denver",
  mt: "America/Denver",
  "us/mountain": "America/Denver",
  pst: "America/Los_Angeles",
  pdt: "America/Los_Angeles",
  pt: "America/Los_Angeles",
  "us/pacific": "America/Los_Angeles",
  akst: "America/Anchorage",
  akdt: "America/Anchorage",
  hst: "Pacific/Honolulu",
  hawaii: "Pacific/Honolulu",

  // Europe
  cet: "Europe/Paris",
  cest: "Europe/Paris",
  eet: "Europe/Athens",
  eest: "Europe/Athens",
  msk: "Europe/Moscow",

  // East Asia & Pacific
  jst: "Asia/Tokyo",
  tokyo: "Asia/Tokyo",
  japan: "Asia/Tokyo",
  kst: "Asia/Seoul",
  korea: "Asia/Seoul",
  cst_china: "Asia/Shanghai",
  hkt: "Asia/Hong_Kong",
  sgt: "Asia/Singapore",
  singapore: "Asia/Singapore",
  "asia/saigon": "Asia/Ho_Chi_Minh",
  vietnam: "Asia/Ho_Chi_Minh",
  aest: "Australia/Sydney",
  aedt: "Australia/Sydney",
  sydney: "Australia/Sydney",
  acst: "Australia/Adelaide",
  acdt: "Australia/Adelaide",
  awst: "Australia/Perth",
  nzst: "Pacific/Auckland",
  nzdt: "Pacific/Auckland",

  // Middle East & Africa
  gst: "Asia/Dubai",
  dubai: "Asia/Dubai",
  ast: "Asia/Riyadh",
  sast: "Africa/Johannesburg",
  eat: "Africa/Nairobi",
  cat: "Africa/Maputo",
  wat: "Africa/Lagos",

  // Latin America
  art: "America/Argentina/Buenos_Aires",
  brt: "America/Sao_Paulo",
  clt: "America/Santiago",
  cot: "America/Bogota",
  pet: "America/Lima",
};

/**
 * Normalizes any user, model, or system timezone input to a valid Trigger.dev IANA timezone.
 */
export function normalizeTriggerTimezone(tz?: string | null): string {
  if (!tz) return "UTC";
  const cleaned = tz.trim();
  if (!cleaned) return "UTC";

  const lower = cleaned.toLowerCase();

  // Check direct alias map
  if (TIMEZONE_CANONICAL_MAP[lower]) {
    return TIMEZONE_CANONICAL_MAP[lower]!;
  }

  // Handle common UTC/GMT offset strings (e.g., "UTC+5:30", "GMT+5", "+05:30", "UTC-5")
  const offsetMatch = cleaned.match(/^(?:UTC|GMT)?\s*([+-])(\d{1,2})(?::?(\d{2}))?$/i);
  if (offsetMatch) {
    const sign = offsetMatch[1];
    const hours = parseInt(offsetMatch[2] ?? "0", 10);
    const minutes = parseInt(offsetMatch[3] ?? "0", 10);
    const totalMinutes = (sign === "-" ? -1 : 1) * (hours * 60 + minutes);

    // Map common offsets to recognized canonical IANA names
    switch (totalMinutes) {
      case -480: return "America/Los_Angeles"; // UTC-8
      case -420: return "America/Denver";      // UTC-7
      case -360: return "America/Chicago";     // UTC-6
      case -300: return "America/New_York";    // UTC-5
      case -240: return "America/Halifax";     // UTC-4
      case -180: return "America/Sao_Paulo";   // UTC-3
      case 0: return "UTC";
      case 60: return "Europe/Paris";          // UTC+1
      case 120: return "Europe/Athens";        // UTC+2
      case 180: return "Europe/Moscow";        // UTC+3
      case 210: return "Asia/Tehran";          // UTC+3:30
      case 240: return "Asia/Dubai";           // UTC+4
      case 270: return "Asia/Kabul";           // UTC+4:30
      case 300: return "Asia/Karachi";         // UTC+5
      case 330: return "Asia/Calcutta";        // UTC+5:30 (IST)
      case 345: return "Asia/Katmandu";        // UTC+5:45 (Nepal)
      case 360: return "Asia/Dhaka";           // UTC+6
      case 390: return "Asia/Yangon";          // UTC+6:30
      case 420: return "Asia/Bangkok";         // UTC+7
      case 480: return "Asia/Singapore";       // UTC+8
      case 540: return "Asia/Tokyo";           // UTC+9
      case 570: return "Australia/Adelaide";   // UTC+9:30
      case 600: return "Australia/Sydney";     // UTC+10
      case 660: return "Pacific/Guadalcanal";  // UTC+11
      case 720: return "Pacific/Auckland";     // UTC+12
    }
  }

  // Format title-case for standard Area/Location paths if input had funky casing (e.g. "america/new_york" -> "America/New_York")
  if (cleaned.includes("/")) {
    const formatted = cleaned
      .split("/")
      .map((part) =>
        part
          .split("_")
          .map((sub) => sub.charAt(0).toUpperCase() + sub.slice(1).toLowerCase())
          .join("_")
      )
      .join("/");

    // Re-check alias on formatted
    const formattedLower = formatted.toLowerCase();
    if (TIMEZONE_CANONICAL_MAP[formattedLower]) {
      return TIMEZONE_CANONICAL_MAP[formattedLower]!;
    }
    return formatted;
  }

  return cleaned;
}

export async function createSchedule(
  userId: string,
  data: CreateScheduleInput,
) {
  const normalizedTimezone = normalizeTriggerTimezone(data.timezone);

  const [inserted] = await db
    .insert(schedules)
    .values({
      userId,
      agentId: data.agentId,
      conversationId: data.conversationId ?? null,
      name: data.name,
      prompt: data.prompt,
      cronExpression: data.cronExpression,
      timezone: normalizedTimezone,
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
      timezone: normalizedTimezone,
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
    console.warn(
      "Could not register recurring schedule with Trigger.dev:",
      err,
    );
  }

  // Broadcast schedule_updated in realtime
  agentEventHub.publish(data.agentId, {
    type: "schedule_updated",
    scheduleId: inserted.id,
    action: "created",
  });

  return { schedule: inserted };
}

export async function updateSchedule(
  id: string,
  userId: string,
  data: UpdateScheduleInput,
) {
  const existing = await getSchedule(id, userId);
  if (!existing) return null;

  const normalizedTimezone = data.timezone
    ? normalizeTriggerTimezone(data.timezone)
    : undefined;

  const [updated] = await db
    .update(schedules)
    .set({
      ...(data.name ? { name: data.name } : {}),
      ...(data.prompt ? { prompt: data.prompt } : {}),
      ...(data.cronExpression ? { cronExpression: data.cronExpression } : {}),
      ...(normalizedTimezone ? { timezone: normalizedTimezone } : {}),
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

      if (data.cronExpression || normalizedTimezone) {
        await triggerSchedules.update(existing.triggerScheduleId, {
          task: "scheduled-agent-task",
          cron: data.cronExpression ?? existing.cronExpression,
          timezone: normalizedTimezone ?? existing.timezone,
        });
      }
    } catch (err) {
      console.warn("Could not sync schedule update with Trigger.dev:", err);
    }
  }

  // Broadcast schedule_updated in realtime
  agentEventHub.publish(updated.agentId, {
    type: "schedule_updated",
    scheduleId: updated.id,
    action: "updated",
  });

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

  if (deleted) {
    agentEventHub.publish(existing.agentId, {
      type: "schedule_updated",
      scheduleId: id,
      action: "deleted",
    });
  }

  return deleted ? { schedule: deleted } : null;
}
