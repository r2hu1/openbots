import { generateObject } from "ai";
import {
  type NaturalScheduleParser,
  parseSchedulePromptSchema,
  fallbackParseSchedulePrompt,
  registerNaturalScheduleParser,
} from "@openbots/api-contract";
import { resolveModel } from "./resolve-model.js";

export const naturalScheduleParser: NaturalScheduleParser = async ({
  userId,
  model,
  prompt,
  timezone,
}) => {
  try {
    const resolvedModel = await resolveModel(userId, model);
    const result = await generateObject({
      model: resolvedModel,
      schema: parseSchedulePromptSchema,
      system:
        "You are an expert AI assistant that translates natural language recurring task descriptions into a structured schedule with a standard 5-field cron expression.\n" +
        "CRITICAL RULES:\n" +
        "1. Extract the exact time of day requested if specified (e.g. '10:52 PM' -> 22:52 -> cron '52 22 * * *', '8:30 am' -> 8:30 -> cron '30 8 * * *').\n" +
        "2. If no time is specified, default to 9:00 AM (e.g. '0 9 * * *').\n" +
        "3. Translate intervals appropriately (e.g. 'every 2 hours' -> '0 */2 * * *', 'every weekday' -> '0 9 * * 1-5').\n" +
        "4. Create a concise, human-friendly title for the task (e.g. 'Check Emails', 'Daily Crypto Summary').\n" +
        "Examples:\n" +
        "- 'check my emails everyday at 10:52 PM IST, give me summary' -> name: 'Check Emails Summary', prompt: 'Check my emails and summarize new unread messages', cronExpression: '52 22 * * *'\n" +
        "- 'check my emails everyday' -> name: 'Daily Email Check', prompt: 'Check my emails and summarize new unread messages', cronExpression: '0 9 * * *'\n" +
        "- 'remind me to check server health every 2 hours' -> name: 'Server Health Check', prompt: 'Check server health and report any anomalies', cronExpression: '0 */2 * * *'\n" +
        "- 'send daily crypto summary at 8am' -> name: 'Daily Crypto Summary', prompt: 'Summarize today\\'s crypto market updates and prices', cronExpression: '0 8 * * *'\n" +
        "- 'check jira tickets every weekday at 10am' -> name: 'Weekday Jira Check', prompt: 'Check open Jira tickets and report active issues', cronExpression: '0 10 * * 1-5'\n" +
        `User timezone: ${timezone || "UTC"}. Always return a valid 5-field cron expression matching the requested time and frequency.`,
      prompt: `Parse this natural language scheduled task:\n"${prompt}"`,
    });

    if (result.object?.cronExpression && result.object?.prompt) {
      return result.object;
    }
  } catch (err) {
    console.warn("LLM natural schedule parsing failed, using fallback:", err);
  }

  return fallbackParseSchedulePrompt(prompt);
};

export function initNaturalScheduleParser() {
  registerNaturalScheduleParser(naturalScheduleParser);
}
