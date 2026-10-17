import { tool } from "ai";
import { z } from "zod";

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
