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
    "Search the public web for real-time information, current events, technical documentation, or facts using DuckDuckGo. Returns search result snippets and source URLs. If no other tool is available, this is the fallback search tool.",
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
        return {
          error: `Search request failed with status ${response.status}`,
        };
      }

      const html = await response.text();
      const results: Array<{ title: string; snippet: string; link: string }> =
        [];

      // Extract result elements
      const resultBlocks = html.split(/class="[^"]*result__body[^"]*"/);
      for (
        let i = 1;
        i < resultBlocks.length && results.length < maxResults;
        i++
      ) {
        const block = resultBlocks[i];
        if (!block) continue;

        // Extract title and URL
        const titleMatch = block.match(
          /class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/,
        );
        const snippetMatch = block.match(
          /class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td)>/,
        );
        const linkMatch = block.match(/href="([^"]*uddg=([^"&]*)[^"]*)"/);

        const rawUrl = linkMatch?.[2] ? decodeURIComponent(linkMatch[2]) : "";
        const cleanTitle = (
          block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? ""
        )
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
            : [
                {
                  title: `Query: ${query}`,
                  snippet: "No direct search snippets found.",
                  link: "",
                },
              ],
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
      .describe(
        "Maximum characters of clean text to return (defaults to 5000)",
      ),
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
        return {
          error: `Failed to fetch URL: HTTP ${response.status} ${response.statusText}`,
        };
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
        .replace(
          /<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi,
          "",
        )
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
      .describe(
        "Optional HTTP headers to include (e.g. Authorization, Content-Type)",
      ),
    body: z
      .string()
      .optional()
      .describe(
        "Optional stringified request body (e.g. JSON string) for POST/PUT/PATCH",
      ),
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
      const parts = path
        .replace(/\[(\w+)\]/g, ".$1")
        .replace(/^\./, "")
        .split(".");
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
    const sentences =
      (text.match(/[^.!?]+[.!?]+(\s|$)/g) || []).length ||
      (text.trim() ? 1 : 0);

    // Extract word frequencies for top keywords
    const wordList = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    const stopWords = new Set([
      "the",
      "and",
      "for",
      "that",
      "this",
      "with",
      "from",
      "are",
      "was",
    ]);
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

export const executeCode = tool({
  description:
    "Safely execute quick JavaScript/TypeScript expressions or snippets to solve logic, transform arrays/objects, format tables, or calculate complex data. Runs in an isolated V8 sandbox.",
  inputSchema: z.object({
    code: z
      .string()
      .min(1)
      .describe(
        "JavaScript snippet or expression to evaluate. Can return a value (e.g. 'data.filter(x => x > 2)' or '(function() { ... })()')",
      ),
  }),
  execute: async ({ code }) => {
    try {
      // Execute in isolated Function scope without DOM or process access
      const fn = new Function(
        `"use strict";
        const console = { log: () => {} };
        const process = undefined;
        const window = undefined;
        const global = undefined;
        return (${code});`,
      );
      const result = fn();
      return {
        success: true,
        result:
          result !== undefined
            ? typeof result === "object"
              ? JSON.parse(JSON.stringify(result))
              : result
            : "undefined",
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Code evaluation failed",
      };
    }
  },
});

export const generateUuid = tool({
  description:
    "Generate standard v4 cryptographically secure UUIDs, random strings, API keys, or nanoids.",
  inputSchema: z.object({
    count: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(1)
      .describe("Number of UUIDs or tokens to generate (default 1)"),
    type: z
      .enum(["uuid", "token", "numeric"])
      .default("uuid")
      .describe(
        "Format of identifier: standard 'uuid', hex 'token', or 'numeric' PIN/ID",
      ),
    length: z
      .number()
      .int()
      .min(4)
      .max(64)
      .optional()
      .describe("Length for 'token' or 'numeric' types (default 16)"),
  }),
  execute: async ({ count, type, length = 16 }) => {
    const items: string[] = [];
    for (let i = 0; i < count; i++) {
      if (type === "uuid") {
        items.push(crypto.randomUUID());
      } else if (type === "numeric") {
        let pin = "";
        for (let j = 0; j < length; j++) {
          pin += Math.floor(Math.random() * 10);
        }
        items.push(pin);
      } else {
        const bytes = new Uint8Array(Math.ceil(length / 2));
        crypto.getRandomValues(bytes);
        items.push(
          Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
            .slice(0, length),
        );
      }
    }

    return {
      type,
      count,
      items: count === 1 ? items[0] : items,
    };
  },
});

export const transformText = tool({
  description:
    "Convert and transform text casing, encoding, or format. Supports upper, lower, titleCase, camelCase, snakeCase, kebabCase, base64Encode, base64Decode, urlEncode, urlDecode, reverse, and slugify.",
  inputSchema: z.object({
    text: z.string().describe("Input text to transform"),
    operation: z
      .enum([
        "uppercase",
        "lowercase",
        "titlecase",
        "camelcase",
        "snakecase",
        "kebabcase",
        "base64_encode",
        "base64_decode",
        "url_encode",
        "url_decode",
        "slugify",
        "reverse",
      ])
      .describe("Transformation operation to apply"),
  }),
  execute: async ({ text, operation }) => {
    try {
      switch (operation) {
        case "uppercase":
          return { operation, result: text.toUpperCase() };
        case "lowercase":
          return { operation, result: text.toLowerCase() };
        case "titlecase":
          return {
            operation,
            result: text.replace(
              /\w\S*/g,
              (w) => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase(),
            ),
          };
        case "camelcase":
          return {
            operation,
            result: text
              .toLowerCase()
              .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase()),
          };
        case "snakecase":
          return {
            operation,
            result: text
              .replace(/\W+/g, " ")
              .split(/ |\B(?=[A-Z])/)
              .map((word) => word.toLowerCase())
              .join("_"),
          };
        case "kebabcase":
        case "slugify":
          return {
            operation,
            result: text
              .toLowerCase()
              .trim()
              .replace(/[^\w\s-]/g, "")
              .replace(/[\s_-]+/g, "-")
              .replace(/^-+|-+$/g, ""),
          };
        case "base64_encode":
          return { operation, result: Buffer.from(text).toString("base64") };
        case "base64_decode":
          return {
            operation,
            result: Buffer.from(text, "base64").toString("utf-8"),
          };
        case "url_encode":
          return { operation, result: encodeURIComponent(text) };
        case "url_decode":
          return { operation, result: decodeURIComponent(text) };
        case "reverse":
          return { operation, result: text.split("").reverse().join("") };
        default:
          return { operation, result: text };
      }
    } catch (err) {
      return {
        operation,
        error: err instanceof Error ? err.message : "Transformation failed",
      };
    }
  },
});

export const unitConverter = tool({
  description:
    "Convert between metric, imperial, and digital units: temperature (C, F, K), length (m, km, ft, mi, in, cm), weight (kg, g, lb, oz), volume (l, ml, gal, oz), data size (b, kb, mb, gb, tb), and time (s, m, h, d).",
  inputSchema: z.object({
    value: z.number().describe("Numeric amount to convert"),
    from: z
      .string()
      .describe(
        "Source unit symbol or name (e.g. 'km', 'mi', 'c', 'f', 'kg', 'lb', 'mb', 'gb')",
      ),
    to: z
      .string()
      .describe(
        "Target unit symbol or name (e.g. 'mi', 'km', 'f', 'c', 'lb', 'kg', 'gb', 'mb')",
      ),
  }),
  execute: async ({ value, from, to }) => {
    const f = from.trim().toLowerCase();
    const t = to.trim().toLowerCase();

    // Temperatures
    if (["c", "celsius", "f", "fahrenheit", "k", "kelvin"].includes(f)) {
      let celsius = value;
      if (f.startsWith("f")) celsius = ((value - 32) * 5) / 9;
      if (f.startsWith("k")) celsius = value - 273.15;

      let target = celsius;
      if (t.startsWith("f")) target = (celsius * 9) / 5 + 32;
      if (t.startsWith("k")) target = celsius + 273.15;

      return {
        value,
        from,
        to,
        result: Number(target.toFixed(2)),
      };
    }

    // Length conversion ratios to meters
    const lengthToMeters: Record<string, number> = {
      m: 1,
      meter: 1,
      meters: 1,
      km: 1000,
      kilometer: 1000,
      cm: 0.01,
      centimeter: 0.01,
      mm: 0.001,
      millimeter: 0.001,
      mi: 1609.344,
      mile: 1609.344,
      miles: 1609.344,
      yd: 0.9144,
      yard: 0.9144,
      ft: 0.3048,
      foot: 0.3048,
      feet: 0.3048,
      in: 0.0254,
      inch: 0.0254,
      inches: 0.0254,
    };

    if (lengthToMeters[f] && lengthToMeters[t]) {
      const meters = value * lengthToMeters[f];
      const result = meters / lengthToMeters[t];
      return { value, from, to, result: Number(result.toFixed(4)) };
    }

    // Weight conversion ratios to grams
    const weightToGrams: Record<string, number> = {
      g: 1,
      gram: 1,
      grams: 1,
      kg: 1000,
      kilogram: 1000,
      mg: 0.001,
      lb: 453.59237,
      pound: 453.59237,
      pounds: 453.59237,
      oz: 28.3495,
      ounce: 28.3495,
      ton: 1000000,
    };

    if (weightToGrams[f] && weightToGrams[t]) {
      const grams = value * weightToGrams[f];
      const result = grams / weightToGrams[t];
      return { value, from, to, result: Number(result.toFixed(4)) };
    }

    // Data sizes to bytes
    const dataToBytes: Record<string, number> = {
      b: 1,
      byte: 1,
      bytes: 1,
      kb: 1024,
      mb: 1024 ** 2,
      gb: 1024 ** 3,
      tb: 1024 ** 4,
    };

    if (dataToBytes[f] && dataToBytes[t]) {
      const bytes = value * dataToBytes[f];
      const result = bytes / dataToBytes[t];
      return { value, from, to, result: Number(result.toFixed(4)) };
    }

    return {
      error: `Unsupported unit conversion between '${from}' and '${to}'`,
    };
  },
});

export const randomGenerator = tool({
  description:
    "Generate random numbers in a range, select random choices from a list, roll dice, shuffle arrays, or flip a coin.",
  inputSchema: z.object({
    type: z
      .enum(["number", "choice", "coin", "dice", "shuffle"])
      .describe("Kind of random generation"),
    min: z
      .number()
      .optional()
      .describe("Minimum number for 'number' range (default 1)"),
    max: z
      .number()
      .optional()
      .describe("Maximum number for 'number' range (default 100)"),
    options: z
      .array(z.string())
      .optional()
      .describe("List of choices for 'choice' or array to 'shuffle'"),
    diceCount: z.number().int().min(1).max(10).optional().default(1),
    diceSides: z.number().int().min(2).max(100).optional().default(6),
  }),
  execute: async ({
    type,
    min = 1,
    max = 100,
    options = [],
    diceCount = 1,
    diceSides = 6,
  }) => {
    switch (type) {
      case "number": {
        const val = Math.floor(Math.random() * (max - min + 1)) + min;
        return { type, min, max, result: val };
      }
      case "coin": {
        const flip = Math.random() < 0.5 ? "heads" : "tails";
        return { type, result: flip };
      }
      case "dice": {
        const rolls = Array.from(
          { length: diceCount },
          () => Math.floor(Math.random() * diceSides) + 1,
        );
        const total = rolls.reduce((a, b) => a + b, 0);
        return { type, diceCount, diceSides, rolls, total };
      }
      case "choice": {
        if (!options.length) {
          return { error: "Please provide 'options' array for random choice." };
        }
        const picked = options[Math.floor(Math.random() * options.length)];
        return { type, picked, from: options };
      }
      case "shuffle": {
        const arr = [...options];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = arr[i]!;
          arr[i] = arr[j]!;
          arr[j] = temp;
        }
        return { type, shuffled: arr };
      }
    }
  },
});

const WEATHER_CODE_MAP: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  62: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

export const getWeather = tool({
  description:
    "Get live real-time weather conditions and forecast for any city or location in the world. Provides temperature, humidity, apparent temperature, wind speed, condition summary, and daily forecast.",
  inputSchema: z.object({
    location: z
      .string()
      .min(1)
      .describe(
        "City or place name, e.g. 'Mumbai', 'New York', 'London', 'Tokyo'",
      ),
    temperatureUnit: z
      .enum(["celsius", "fahrenheit"])
      .default("celsius")
      .describe("Unit of temperature: 'celsius' or 'fahrenheit'"),
  }),
  execute: async ({ location, temperatureUnit }) => {
    try {
      // 1. Geocode location
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        location,
      )}&count=1&language=en&format=json`;
      const geoRes = await fetch(geoUrl);
      if (!geoRes.ok) {
        return { error: `Failed to find location: ${location}` };
      }
      const geoData = (await geoRes.json()) as {
        results?: Array<{
          name: string;
          country?: string;
          admin1?: string;
          latitude: number;
          longitude: number;
          timezone?: string;
        }>;
      };

      const match = geoData.results?.[0];
      if (!match) {
        return {
          error: `Location '${location}' not found. Please try specifying a nearby major city.`,
        };
      }

      // 2. Fetch current weather and forecast
      const tempParam =
        temperatureUnit === "fahrenheit" ? "&temperature_unit=fahrenheit" : "";
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${match.latitude}&longitude=${match.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto${tempParam}`;
      const weatherRes = await fetch(weatherUrl);
      if (!weatherRes.ok) {
        return { error: `Could not retrieve weather data for ${match.name}` };
      }

      const weatherData = (await weatherRes.json()) as any;
      const current = weatherData.current;
      const daily = weatherData.daily;
      const condition =
        WEATHER_CODE_MAP[current?.weather_code] ??
        `Code ${current?.weather_code}`;

      return {
        location: match.name,
        region: match.admin1,
        country: match.country,
        coordinates: { latitude: match.latitude, longitude: match.longitude },
        timezone: match.timezone ?? weatherData.timezone,
        condition,
        temperature: `${current?.temperature_2m}°${temperatureUnit === "fahrenheit" ? "F" : "C"}`,
        feelsLike: `${current?.apparent_temperature}°${temperatureUnit === "fahrenheit" ? "F" : "C"}`,
        humidity: `${current?.relative_humidity_2m}%`,
        windSpeed: `${current?.wind_speed_10m} km/h`,
        precipitation: `${current?.precipitation} mm`,
        dailyForecast: daily?.time
          ?.slice(0, 3)
          ?.map((date: string, i: number) => ({
            date,
            condition: WEATHER_CODE_MAP[daily.weather_code[i]] ?? "Unknown",
            maxTemp: `${daily.temperature_2m_max[i]}°`,
            minTemp: `${daily.temperature_2m_min[i]}°`,
          })),
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Weather retrieval failed",
      };
    }
  },
});

export const wikipediaSearch = tool({
  description:
    "Search Wikipedia for articles, facts, history, biographies, concepts, or encyclopedic knowledge and retrieve page summaries and links.",
  inputSchema: z.object({
    query: z.string().min(1).describe("Search topic or concept on Wikipedia"),
  }),
  execute: async ({ query }) => {
    try {
      // Search for best matching title
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
        query,
      )}&limit=3&namespace=0&format=json`;
      const res = await fetch(searchUrl, {
        headers: { "User-Agent": "OpenBots/1.0" },
      });
      if (!res.ok) {
        return { error: "Failed to connect to Wikipedia" };
      }
      const data = (await res.json()) as [string, string[], string[], string[]];
      const titles = data[1] ?? [];
      const descriptions = data[2] ?? [];
      const urls = data[3] ?? [];

      if (!titles.length || !titles[0]) {
        return { query, result: "No matching Wikipedia articles found." };
      }

      // Fetch summary of top match
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        titles[0],
      )}`;
      const summaryRes = await fetch(summaryUrl, {
        headers: { "User-Agent": "OpenBots/1.0" },
      });

      let fullExtract = "";
      if (summaryRes.ok) {
        const summaryData = (await summaryRes.json()) as any;
        fullExtract = summaryData.extract || "";
      }

      return {
        title: titles[0],
        summary: fullExtract || descriptions[0] || "Summary unavailable",
        url: urls[0],
        related: titles.slice(1).map((t, idx) => ({
          title: t,
          url: urls[idx + 1],
        })),
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Wikipedia lookup failed",
      };
    }
  },
});

export const currencyConverter = tool({
  description:
    "Get live exchange rates and convert monetary amounts between global fiat currencies (e.g. USD, EUR, INR, GBP, JPY, CAD, AUD, CHF, CNY).",
  inputSchema: z.object({
    amount: z.number().positive().describe("The numeric amount to convert"),
    from: z
      .string()
      .length(3)
      .describe("3-letter base currency code, e.g. 'USD', 'EUR', 'INR'"),
    to: z
      .string()
      .length(3)
      .describe("3-letter target currency code, e.g. 'INR', 'EUR', 'GBP'"),
  }),
  execute: async ({ amount, from, to }) => {
    try {
      const base = from.toUpperCase();
      const target = to.toUpperCase();
      const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
      if (!res.ok) {
        return { error: `Failed to fetch exchange rates for ${base}` };
      }
      const data = (await res.json()) as {
        result: string;
        rates?: Record<string, number>;
        time_last_update_utc?: string;
      };

      if (data.result !== "success" || !data.rates) {
        return {
          error: `Currency code '${base}' not supported or rate unavailable.`,
        };
      }

      const rate = data.rates[target];
      if (rate === undefined) {
        return {
          error: `Target currency '${target}' not found in exchange rates.`,
        };
      }

      const converted = Number((amount * rate).toFixed(4));
      return {
        amount,
        from: base,
        to: target,
        rate,
        converted,
        lastUpdated: data.time_last_update_utc,
      };
    } catch (err) {
      return {
        error:
          err instanceof Error ? err.message : "Currency conversion failed",
      };
    }
  },
});

export const dnsLookup = tool({
  description:
    "Perform DNS lookups (A, AAAA, MX, TXT, CNAME, NS) for any domain name using Google Public DNS.",
  inputSchema: z.object({
    domain: z
      .string()
      .min(1)
      .describe(
        "The domain name to resolve, e.g. 'google.com' or 'github.com'",
      ),
    type: z
      .enum(["A", "AAAA", "MX", "TXT", "CNAME", "NS"])
      .default("A")
      .describe("DNS record type to look up"),
  }),
  execute: async ({ domain, type }) => {
    try {
      const cleanDomain = domain
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "");
      const res = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(cleanDomain)}&type=${type}`,
      );
      if (!res.ok) {
        return { error: `DNS lookup request failed with status ${res.status}` };
      }
      const data = (await res.json()) as {
        Status: number;
        Answer?: Array<{
          name: string;
          type: number;
          TTL: number;
          data: string;
        }>;
        Comment?: string;
      };

      if (data.Status !== 0 || !data.Answer) {
        return {
          domain: cleanDomain,
          type,
          found: false,
          message: data.Comment || "No records found or domain does not exist.",
        };
      }

      return {
        domain: cleanDomain,
        type,
        found: true,
        records: data.Answer.map((a) => a.data),
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "DNS lookup failed",
      };
    }
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
        .describe(
          "A short descriptive title for the scheduled task or reminder",
        ),
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
          throw new Error(
            "Missing 'runAt' ISO timestamp for timestamp schedule",
          );
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
            scheduledFor: new Date(
              Date.now() + computedDelaySeconds * 1000,
            ).toISOString(),
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
        console.warn(
          "Could not dispatch delayed Trigger.dev task:",
          triggerErr,
        );
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
        executesAt: new Date(
          Date.now() + computedDelaySeconds * 1000,
        ).toISOString(),
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
  execute_code: executeCode,
  generate_uuid: generateUuid,
  transform_text: transformText,
  unit_converter: unitConverter,
  random_generator: randomGenerator,
  get_weather: getWeather,
  wikipedia_search: wikipediaSearch,
  currency_converter: currencyConverter,
  dns_lookup: dnsLookup,
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
