import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { agentTools, connections, db, runs, schedules } from "@openbots/db";
import { tasks } from "@trigger.dev/sdk";
import { jsonSchema, tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

function parseArithmetic(expr: string): number {
  let pos = 0;

  function peek(): string {
    while (pos < expr.length && expr[pos] === " ") pos++;
    return expr[pos] ?? "";
  }

  function get(): string {
    while (pos < expr.length && expr[pos] === " ") pos++;
    return expr[pos++] ?? "";
  }

  function parsePrimary(): number {
    const ch = peek();
    if (ch === "+") {
      get();
      return parsePrimary();
    }
    if (ch === "-") {
      get();
      return -parsePrimary();
    }
    if (ch === "(") {
      get();
      const val = parseExpr();
      if (peek() === ")") {
        get();
      } else {
        throw new Error("Mismatched parentheses: expected ')'");
      }
      return val;
    }
    let numStr = "";
    while (peek() && /[0-9.]/.test(peek())) {
      numStr += get();
    }
    if (!numStr) {
      throw new Error(`Unexpected character in expression: '${peek()}'`);
    }
    const n = Number(numStr);
    if (Number.isNaN(n)) {
      throw new Error(`Invalid number: '${numStr}'`);
    }
    return n;
  }

  function parsePower(): number {
    let left = parsePrimary();
    while (peek() === "^") {
      get();
      const right = parsePower();
      left = left ** right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parsePower();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = get();
      const right = parsePower();
      if (op === "*") {
        left *= right;
      } else if (op === "/") {
        if (right === 0) throw new Error("Division by zero");
        left /= right;
      } else if (op === "%") {
        if (right === 0) throw new Error("Modulo by zero");
        left %= right;
      }
    }
    return left;
  }

  function parseExpr(): number {
    let left = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = get();
      const right = parseTerm();
      if (op === "+") left += right;
      else if (op === "-") left -= right;
    }
    return left;
  }

  const result = parseExpr();
  while (pos < expr.length && expr[pos] === " ") pos++;
  if (pos < expr.length) {
    throw new Error(
      `Unexpected token at position ${pos}: '${expr.slice(pos)}'`,
    );
  }
  return result;
}

export const getCurrentTime = tool({
  description:
    "Get the current date and time with timezone and calendar breakdown. Use this whenever the user asks for the current time, date, day of the week, or year.",
  inputSchema: z.object({
    timezone: z
      .string()
      .optional()
      .describe(
        "Optional IANA timezone name (e.g. 'UTC', 'America/New_York', 'Asia/Tokyo'). Defaults to UTC.",
      ),
  }),
  execute: async ({ timezone }) => {
    const now = new Date();
    const tz = timezone ?? "UTC";
    return {
      iso: now.toISOString(),
      timestamp: now.getTime(),
      timezone: tz,
      formatted: now.toLocaleString("en-US", { timeZone: tz }),
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
      day: now.getUTCDate(),
      hours: now.getUTCHours(),
      minutes: now.getUTCMinutes(),
      seconds: now.getUTCSeconds(),
    };
  },
});

export const calculate = tool({
  description:
    "Safely evaluate a mathematical arithmetic expression without using code evaluation. Supports +, -, *, /, %, ^, parentheses, and decimals.",
  inputSchema: z.object({
    expression: z
      .string()
      .describe(
        "Mathematical arithmetic expression to evaluate, e.g. '15 * 3 + 2' or '(100 - 25) / 5'",
      ),
  }),
  execute: async ({ expression }) => {
    try {
      const result = parseArithmetic(expression);
      return {
        expression,
        result,
      };
    } catch (err) {
      return {
        expression,
        error: err instanceof Error ? err.message : "Calculation failed",
      };
    }
  },
});

export const webSearch = tool({
  description:
    "Search the public web for real-time information, current events, technical documentation, or facts using DuckDuckGo. Returns search result snippets and source URLs.",
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .describe("The search keywords or query to look up on the web"),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(5)
      .describe("Maximum number of search results to return (default 5)"),
  }),
  execute: async ({ query, maxResults }) => {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        return { error: `Search request failed with status ${response.status}` };
      }

      const html = await response.text();
      const results: Array<{ title: string; snippet: string; link: string }> = [];

      // Extract result elements
      const resultBlocks = html.split(/class="[^"]*result__body[^"]*"/);
      for (let i = 1; i < resultBlocks.length && results.length < maxResults; i++) {
        const block = resultBlocks[i];
        if (!block) continue;

        // Extract title and URL
        const titleMatch = block.match(/class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/);
        const snippetMatch = block.match(/class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td)>/);
        const linkMatch = block.match(/href="([^"]*uddg=([^"&]*)[^"]*)"/);

        const rawUrl = linkMatch?.[2] ? decodeURIComponent(linkMatch[2]) : "";
        const cleanTitle = (block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "")
          .replace(/<[^>]*>/g, "")
          .trim();
        const cleanSnippet = (snippetMatch?.[1] ?? titleMatch?.[1] ?? "")
          .replace(/<[^>]*>/g, "")
          .trim();

        if (cleanTitle && rawUrl) {
          results.push({
            title: cleanTitle,
            snippet: cleanSnippet,
            link: rawUrl,
          });
        }
      }

      return {
        query,
        count: results.length,
        results:
          results.length > 0
            ? results
            : [{ title: `Query: ${query}`, snippet: "No direct search snippets found.", link: "" }],
      };
    } catch (err) {
      return {
        query,
        error: err instanceof Error ? err.message : "Search failed",
      };
    }
  },
});

export const fetchWebPage = tool({
  description:
    "Fetch and extract readable text content from any public URL. Useful for reading web articles, API documentation, raw data, or documentation pages.",
  inputSchema: z.object({
    url: z.string().url().describe("The full public HTTP or HTTPS URL to read"),
    maxLength: z
      .number()
      .int()
      .min(500)
      .max(20000)
      .default(5000)
      .describe("Maximum characters of clean text to return (defaults to 5000)"),
  }),
  execute: async ({ url, maxLength }) => {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/json,text/plain",
        },
      });

      if (!response.ok) {
        return { error: `Failed to fetch URL: HTTP ${response.status} ${response.statusText}` };
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await response.json();
        const stringified = JSON.stringify(json, null, 2);
        return {
          url,
          contentType: "json",
          content: stringified.slice(0, maxLength),
        };
      }

      const raw = await response.text();
      // Basic HTML to markdown/text conversion
      const clean = raw
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")
        .trim();

      return {
        url,
        contentType,
        length: clean.length,
        content: clean.slice(0, maxLength),
      };
    } catch (err) {
      return {
        url,
        error: err instanceof Error ? err.message : "Failed to fetch webpage",
      };
    }
  },
});

export const httpRequest = tool({
  description:
    "Make an HTTP API request (GET, POST, PUT, PATCH, DELETE) to any external REST API or webhook. Useful for sending webhooks, querying public APIs, or interacting with custom backends.",
  inputSchema: z.object({
    url: z.string().url().describe("The target HTTP or HTTPS URL"),
    method: z
      .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
      .default("GET")
      .describe("HTTP method to use"),
    headers: z
      .record(z.string(), z.string())
      .optional()
      .describe("Optional HTTP headers to include (e.g. Authorization, Content-Type)"),
    body: z
      .string()
      .optional()
      .describe("Optional stringified request body (e.g. JSON string) for POST/PUT/PATCH"),
  }),
  execute: async ({ url, method, headers, body }) => {
    try {
      const response = await fetch(url, {
        method,
        headers: headers ?? {},
        body: ["POST", "PUT", "PATCH"].includes(method) ? body : undefined,
      });

      const responseContentType = response.headers.get("content-type") || "";
      let responseBody: any = null;

      if (responseContentType.includes("application/json")) {
        try {
          responseBody = await response.json();
        } catch {
          responseBody = await response.text();
        }
      } else {
        responseBody = await response.text();
        if (typeof responseBody === "string" && responseBody.length > 5000) {
          responseBody = `${responseBody.slice(0, 5000)}... [truncated]`;
        }
      }

      return {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        data: responseBody,
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "HTTP request failed",
      };
    }
  },
});

export const jsonParser = tool({
  description:
    "Parse, validate, query, or extract specific paths from raw JSON text data without execution errors.",
  inputSchema: z.object({
    jsonString: z.string().describe("The raw JSON text string to parse"),
    path: z
      .string()
      .optional()
      .describe(
        "Optional dot-notation property path to extract from the parsed object (e.g. 'data.user.email' or 'items[0]')",
      ),
  }),
  execute: async ({ jsonString, path }) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!path) {
        return { success: true, result: parsed };
      }

      // Safe path extraction
      const parts = path.replace(/\[(\w+)\]/g, ".$1").replace(/^\./, "").split(".");
      let current: any = parsed;
      for (const part of parts) {
        if (current === null || current === undefined) {
          return { success: true, path, result: null };
        }
        current = current[part];
      }

      return { success: true, path, result: current };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Invalid JSON",
      };
    }
  },
});

export const textAnalyzer = tool({
  description:
    "Analyze text metrics: word count, character count, sentence count, line count, language characteristics, and extract keywords or frequency maps.",
  inputSchema: z.object({
    text: z.string().describe("The text string to analyze"),
  }),
  execute: async ({ text }) => {
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text.split(/\r\n|\r|\n/).length;
    const sentences = (text.match(/[^.!?]+[.!?]+(\s|$)/g) || []).length || (text.trim() ? 1 : 0);

    // Extract word frequencies for top keywords
    const wordList = (text.toLowerCase().match(/\b[a-z]{3,}\b/g) || []);
    const stopWords = new Set(["the", "and", "for", "that", "this", "with", "from", "are", "was"]);
    const frequency: Record<string, number> = {};
    for (const w of wordList) {
      if (!stopWords.has(w)) {
        frequency[w] = (frequency[w] || 0) + 1;
      }
    }

    const topKeywords = Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    return {
      characters: chars,
      words,
      sentences,
      lines,
      averageWordLength: words > 0 ? Number((chars / words).toFixed(1)) : 0,
      topKeywords,
    };
  },
});

export function createScheduleTool(
  userId: string,
  agentId: string,
  conversationId?: string | null,
) {
  return tool({
    description:
      "Schedule any kind of future task, reminder, delayed execution, or recurring job. " +
      "Use this for: " +
      "(1) Delayed execution or reminders (e.g. 'in 1 minute', 'in 30 seconds', 'after 2 hours', 'remind me to have tea'), " +
      "(2) Specific future timestamps/dates (e.g. 'at 5:00 PM', 'tomorrow at 9am', 'on Oct 10th'), " +
      "(3) Recurring schedules (e.g. 'every day at 9am', 'every 15 minutes', 'every Monday'). " +
      "ALWAYS use this tool for all scheduling, delayed triggers, reminders, and timers.",
    inputSchema: z.object({
      name: z
        .string()
        .describe("A short descriptive title for the scheduled task or reminder"),
      prompt: z
        .string()
        .describe(
          "The instruction, reminder message, or task to execute when the schedule triggers",
        ),
      type: z
        .enum(["delay", "recurring", "timestamp"])
        .default("delay")
        .describe(
          "Schedule type: 'delay' for one-off tasks relative to now (e.g. in 1 min), 'timestamp' for specific date/time, 'recurring' for cron schedules",
        ),
      delaySeconds: z
        .number()
        .optional()
        .describe(
          "Seconds to wait before executing (required for 'delay' type, e.g. 60 for 1 minute, 120 for 2 minutes, 3600 for 1 hour)",
        ),
      runAt: z
        .string()
        .optional()
        .describe(
          "ISO 8601 timestamp string for when to run (e.g. '2026-10-02T15:00:00Z')",
        ),
      cronExpression: z
        .string()
        .optional()
        .describe(
          "A standard 5-field cron expression for recurring tasks (e.g. '0 9 * * *' for daily at 9am, '*/15 * * * *' for every 15 minutes)",
        ),
      timezone: z
        .string()
        .optional()
        .describe(
          "IANA timezone (e.g. 'America/New_York', 'Asia/Kolkata', 'UTC'). Defaults to UTC.",
        ),
    }),
    execute: async ({
      name,
      prompt,
      type,
      delaySeconds,
      runAt,
      cronExpression,
      timezone,
    }) => {
      // 1. Recurring Cron Schedule
      if (type === "recurring" || (cronExpression && !delaySeconds && !runAt)) {
        const cron = cronExpression ?? "0 9 * * *";
        const inserted = await db
          .insert(schedules)
          .values({
            userId,
            agentId,
            name,
            prompt,
            cronExpression: cron,
            timezone: timezone ?? "UTC",
            status: "active",
          })
          .returning();
        const schedule = inserted[0];

        if (!schedule) {
          throw new Error("Failed to create recurring schedule");
        }

        return {
          scheduleId: schedule.id,
          name: schedule.name,
          type: "recurring",
          cronExpression: schedule.cronExpression,
          timezone: schedule.timezone,
          status: schedule.status,
          message: `Recurring schedule '${name}' set. It will execute with cron '${cron}' in timezone ${schedule.timezone}.`,
        };
      }

      // 2. One-off Specific Timestamp or Relative Delay
      let computedDelaySeconds = delaySeconds;

      if (type === "timestamp" || runAt) {
        if (!runAt) {
          throw new Error("Missing 'runAt' ISO timestamp for timestamp schedule");
        }
        const targetTime = new Date(runAt).getTime();
        const now = Date.now();
        const diffMs = targetTime - now;
        computedDelaySeconds = Math.max(1, Math.round(diffMs / 1000));
      }

      if (!computedDelaySeconds || computedDelaySeconds <= 0) {
        computedDelaySeconds = 60; // fallback to 1 minute if unspecified
      }

      // Queue run in database
      const [newRun] = await db
        .insert(runs)
        .values({
          userId,
          agentId,
          conversationId: conversationId ?? null,
          status: "queued",
          triggerType: "schedule",
          input: {
            prompt,
            scheduledTaskName: name,
            scheduledFor: new Date(Date.now() + computedDelaySeconds * 1000).toISOString(),
          },
        })
        .returning();

      if (!newRun) {
        throw new Error("Failed to queue scheduled run");
      }

      // Dispatch delayed task to Trigger.dev
      try {
        await tasks.trigger(
          "agent-run",
          { runId: newRun.id },
          {
            delay: `${computedDelaySeconds}s`,
            idempotencyKey: newRun.id,
            tags: [newRun.id, userId],
          },
        );
      } catch (triggerErr) {
        console.warn("Could not dispatch delayed Trigger.dev task:", triggerErr);
      }

      const durationStr =
        computedDelaySeconds < 60
          ? `${computedDelaySeconds} second${computedDelaySeconds === 1 ? "" : "s"}`
          : computedDelaySeconds < 3600
            ? `${Math.round(computedDelaySeconds / 60)} minute${Math.round(computedDelaySeconds / 60) === 1 ? "" : "s"}`
            : `${(computedDelaySeconds / 3600).toFixed(1)} hours`;

      return {
        runId: newRun.id,
        name,
        type: "delay",
        delaySeconds: computedDelaySeconds,
        executesAt: new Date(Date.now() + computedDelaySeconds * 1000).toISOString(),
        message: `Scheduled reminder '${name}' successfully set for ${durationStr} from now. I will trigger and perform this task automatically.`,
      };
    },
  });
}

export const internalTools: Record<string, any> = {
  get_current_time: getCurrentTime,
  calculate: calculate,
  web_search: webSearch,
  fetch_web_page: fetchWebPage,
  http_request: httpRequest,
  json_parser: jsonParser,
  text_analyzer: textAnalyzer,
};

/**
 * OpenBots Tool Execution & Idempotency Semantics:
 *
 * 1. Internal Tools (get_current_time, calculate):
 *    - Pure read and compute functions.
 *    - Naturally idempotent and side-effect free.
 *    - Safe for retries and re-evaluation.
 *
 * 2. External Tools (Composio, MCP):
 *    - OpenBots runtime provides AT-MOST-ONCE execution guarantees for claimed runs:
 *      an agent run is atomically claimed from 'queued' to 'running', preventing duplicate
 *      workers from executing concurrently or re-executing terminal runs.
 *    - However, once a tool execution step dispatches to an external SaaS provider via Composio
 *      (e.g., Slack, Gmail, GitHub, Linear) or MCP, the external action produces real-world side effects.
 *    - Most upstream SaaS APIs do NOT support universal idempotency keys or distributed transaction rollback.
 *    - If a network partition or system crash occurs mid-run after a tool has executed, retrying
 *      or repeating that tool call may result in duplicate side effects (e.g. duplicate emails or messages).
 *    - When the underlying tool/provider supports idempotency keys (e.g., payment gateways or transactional
 *      APIs accepting client idempotency tokens), callers should supply those idempotency parameters in the
 *      tool input schema.
 *    - OpenBots explicitly does NOT claim exactly-once side-effect execution for non-idempotent third-party APIs.
 */
export interface ResolvedTools {
  tools: Record<string, any>;
  cleanup: () => Promise<void>;
}

export async function buildAgentTools(params: {
  userId: string;
  agentId: string;
  conversationId?: string | null;
}): Promise<ResolvedTools> {
  const { userId, agentId, conversationId } = params;
  const configuredTools = await db
    .select()
    .from(agentTools)
    .where(and(eq(agentTools.agentId, agentId), eq(agentTools.enabled, true)));

  const activeTools: Record<string, any> = {
    create_schedule: createScheduleTool(userId, agentId, conversationId),
  };
  const cleanupTasks: Array<() => Promise<void>> = [];

  // Auto-inject Composio session meta-tools when API key is available
  const composioApiKey = process.env.COMPOSIO_API_KEY;
  if (composioApiKey) {
    try {
      const composio = new Composio({
        apiKey: composioApiKey,
        provider: new VercelProvider(),
      });

      const [existingConn] = await db
        .select()
        .from(connections)
        .where(
          and(
            eq(connections.userId, userId),
            eq(connections.provider, "composio"),
            eq(connections.status, "active"),
          ),
        );

      let session: any = null;
      if (existingConn?.externalAccountId) {
        try {
          session = await composio.use(existingConn.externalAccountId);
        } catch {
          session = null;
        }
      }

      if (!session) {
        session = await composio.create(userId, {
          sandbox: { enable: false },
          manageConnections: true,
        });

        if (existingConn) {
          await db
            .update(connections)
            .set({
              externalAccountId: session.sessionId,
              updatedAt: new Date(),
            })
            .where(eq(connections.id, existingConn.id));
        } else {
          await db.insert(connections).values({
            userId,
            provider: "composio",
            externalAccountId: session.sessionId,
            status: "active",
          });
        }
      }

      const composioTools = await session.tools();
      if (Array.isArray(composioTools)) {
        for (const t of composioTools) {
          if (t && typeof t === "object" && "name" in t) {
            activeTools[t.name] = t;
          }
        }
      } else if (composioTools && typeof composioTools === "object") {
        for (const [key, value] of Object.entries(composioTools)) {
          if (value) {
            activeTools[key] = value;
          }
        }
      }
    } catch (err) {
      console.warn("Failed to initialize Composio session:", err);
    }
  }

  for (const config of configuredTools) {
    if (config.provider === "internal") {
      const found = internalTools[config.toolName];
      if (found) {
        activeTools[config.toolName] = found;
      }
    } else if (config.provider === "mcp") {
      const mcpConfig = config.config as { url?: string } | null;
      if (!mcpConfig?.url) {
        throw new Error(
          `MCP tool '${config.toolName}' requires a server URL in configuration`,
        );
      }

      const client = new Client({
        name: "openbots-agent",
        version: "1.0.0",
      });

      const transport = new StreamableHTTPClientTransport(
        new URL(mcpConfig.url),
      );
      await client.connect(transport);
      cleanupTasks.push(async () => {
        try {
          await client.close();
        } catch {
          // Ignore transport close errors
        }
      });

      const { tools: mcpToolsList } = await client.listTools();
      const targetMcpTool = mcpToolsList.find(
        (t) => t.name === config.toolName,
      );

      if (targetMcpTool) {
        activeTools[config.toolName] = tool({
          description: targetMcpTool.description ?? "",
          inputSchema: jsonSchema(targetMcpTool.inputSchema as any),
          execute: async (args: any) => {
            const callRes = await client.callTool({
              name: targetMcpTool.name,
              arguments: args,
            });
            return callRes;
          },
        });
      }
    }
  }

  return {
    tools: activeTools,
    cleanup: async () => {
      for (const cleanup of cleanupTasks) {
        await cleanup();
      }
    },
  };
}
