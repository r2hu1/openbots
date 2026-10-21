import { z } from "zod";

export const parseSchedulePromptSchema = z.object({
  name: z.string().describe("A concise descriptive title for the scheduled task, e.g. 'Daily Email Check'"),
  prompt: z.string().describe("The exact instruction prompt for the agent to execute when triggered, e.g. 'Check my emails and summarize unread messages'"),
  cronExpression: z.string().describe("A standard 5-field cron expression, e.g. '0 9 * * *' for every day at 9am"),
});

export type ParsedScheduleOutput = z.infer<typeof parseSchedulePromptSchema>;

export type NaturalScheduleParser = (params: {
  userId: string;
  model: string;
  prompt: string;
  timezone?: string;
}) => Promise<ParsedScheduleOutput>;

let naturalScheduleParser: NaturalScheduleParser | null = null;

export function registerNaturalScheduleParser(parser: NaturalScheduleParser) {
  naturalScheduleParser = parser;
}

export function getNaturalScheduleParser(): NaturalScheduleParser | null {
  return naturalScheduleParser;
}

export function parseNaturalTime(str: string): { hour: number; minute: number } | null {
  // matches e.g. "at 10:52 PM", "at 9am", "at 18:30", "10:52pm", "10:52 PM"
  const timeRegex = /(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
  const match = str.match(timeRegex);
  if (!match) return null;
  let hour = parseInt(match[1] ?? "", 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const meridian = match[3] ? match[3].toLowerCase() : null;

  if (meridian === "pm" && hour < 12) hour += 12;
  if (meridian === "am" && hour === 12) hour = 0;
  if (isNaN(hour) || hour < 0 || hour > 23 || isNaN(minute) || minute < 0 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

export function fallbackParseSchedulePrompt(prompt: string): ParsedScheduleOutput {
  const lower = prompt.toLowerCase();
  const parsedTime = parseNaturalTime(lower);
  const hour = parsedTime ? parsedTime.hour : 9;
  const minute = parsedTime ? parsedTime.minute : 0;

  let cron = `${minute} ${hour} * * *`; // default daily at parsed time (or 9:00 AM)

  if (lower.includes("hourly") || lower.includes("every hour")) {
    cron = `${minute} * * * *`;
  } else if (lower.includes("every 2 hours")) {
    cron = `${minute} */2 * * *`;
  } else if (lower.includes("every 4 hours")) {
    cron = `${minute} */4 * * *`;
  } else if (lower.includes("every 6 hours")) {
    cron = `${minute} */6 * * *`;
  } else if (lower.includes("weekday") || lower.includes("monday to friday")) {
    cron = `${minute} ${hour} * * 1-5`;
  } else if (lower.includes("weekly") || lower.includes("every week")) {
    cron = `${minute} ${hour} * * 1`;
  } else if (lower.includes("monthly") || lower.includes("every month")) {
    cron = `${minute} ${hour} 1 * *`;
  }

  // Generate a clean concise title
  let cleanTitle = prompt
    .replace(/^please\s+/i, "")
    .replace(/\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i, "")
    .replace(/\b(?:everyday|every\s*day|daily|weekly|hourly|monthly|ist|utc|est|pst|cst|gmt)\b/gi, "")
    .replace(/\s*,\s*/g, " - ")
    .replace(/\s+/g, " ")
    .replace(/[-–—,:;]+$/, "")
    .trim();

  if (!cleanTitle || cleanTitle.length < 3) {
    cleanTitle = prompt.trim().split(/\s+/).slice(0, 5).join(" ");
  }

  const name = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

  return {
    name,
    prompt: prompt.trim(),
    cronExpression: cron,
  };
}
