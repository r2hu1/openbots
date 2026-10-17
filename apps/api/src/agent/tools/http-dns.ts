import { tool } from "ai";
import { z } from "zod";

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
