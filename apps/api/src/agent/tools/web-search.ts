import { tool } from "ai";
import { z } from "zod";

export const webSearch = tool({
  description:
    "Search the public web for real-time information, current events, technical documentation, or facts. Automatically tries multiple search engines if rate limited or unavailable. Returns search result snippets and source URLs.",
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
    const userAgents: string[] = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    ];
    const getRandomUA = (): string =>
      userAgents[Math.floor(Math.random() * userAgents.length)] ??
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    type SearchResult = { title: string; snippet: string; link: string };

    const tryDuckDuckGoHtml = async (): Promise<SearchResult[]> => {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const headers: Record<string, string> = {
        "User-Agent": getRandomUA(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      };
      const response = await fetch(url, { headers });
      if (!response.ok) return [];

      const html = await response.text();
      const results: SearchResult[] = [];
      const resultBlocks = html.split(/class="[^"]*result__body[^"]*"/);

      for (
        let i = 1;
        i < resultBlocks.length && results.length < maxResults;
        i++
      ) {
        const block = resultBlocks[i];
        if (!block) continue;

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
      return results;
    };

    const tryDuckDuckGoLite = async (): Promise<SearchResult[]> => {
      const headers: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": getRandomUA(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      };
      const response = await fetch("https://lite.duckduckgo.com/lite/", {
        method: "POST",
        headers,
        body: `q=${encodeURIComponent(query)}`,
      });
      if (!response.ok) return [];

      const html = await response.text();
      const results: SearchResult[] = [];
      const linkRegex =
        /<a\s+[^>]*href=["']([^"']+)["'][^>]*class=["']result-link["'][^>]*>([\s\S]*?)<\/a>/gi;
      const snippetRegex =
        /<td\s+class=["']result-snippet["'][^>]*>([\s\S]*?)<\/td>/gi;

      const links = [...html.matchAll(linkRegex)];
      const snippets = [...html.matchAll(snippetRegex)];

      for (let i = 0; i < links.length && results.length < maxResults; i++) {
        const linkMatch = links[i];
        if (!linkMatch) continue;
        let url = linkMatch[1] ?? "";
        if (url.includes("uddg=")) {
          const match = url.match(/uddg=([^&]+)/);
          if (match?.[1]) url = decodeURIComponent(match[1]);
        }
        const title = (linkMatch[2] ?? "").replace(/<[^>]*>/g, "").trim();
        const snippetItem = snippets[i];
        const snippet = snippetItem?.[1]
          ? snippetItem[1].replace(/<[^>]*>/g, "").trim()
          : "";
        if (title && url) {
          results.push({ title, snippet, link: url });
        }
      }
      return results;
    };

    const tryBraveSearch = async (): Promise<SearchResult[]> => {
      const headers: Record<string, string> = {
        "User-Agent": getRandomUA(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      };
      const response = await fetch(
        `https://search.brave.com/search?q=${encodeURIComponent(query)}`,
        { headers },
      );
      if (!response.ok) return [];

      const html = await response.text();
      const results: SearchResult[] = [];
      const titleMatches = [
        ...html.matchAll(
          /<a\s+[^>]*href="(https?:\/\/(?!search\.brave)[^"]+)"[^>]*>[\s\S]*?<div\s+class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        ),
      ];

      for (const m of titleMatches) {
        if (results.length >= maxResults) break;
        const link = m[1];
        const title = (m[2] ?? "").replace(/<[^>]*>/g, "").trim();
        const postIndex = m.index + m[0].length;
        const following = html.slice(postIndex, postIndex + 900);
        const descMatch =
          following.match(
            /<div\s+class="[^"]*snippet-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          ) || following.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
        const snippet = descMatch?.[1]
          ? descMatch[1].replace(/<[^>]*>/g, "").trim()
          : "";

        if (title && link) {
          results.push({ title, snippet, link });
        }
      }
      return results;
    };

    const tryWikipedia = async (): Promise<SearchResult[]> => {
      const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "OpenBots/1.0 (agent-websearch; support@openbots.ai)",
          Accept: "application/json",
        },
      });
      if (!response.ok) return [];

      const data = await response.json();
      const items = (data?.query?.search || []).slice(0, maxResults);
      return items.map((item: any) => ({
        title: item.title,
        snippet: (item.snippet || "").replace(/<[^>]*>/g, "").trim(),
        link: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
      }));
    };

    try {
      let results: SearchResult[] = [];
      let usedProvider = "DuckDuckGo";

      try {
        results = await tryDuckDuckGoHtml();
      } catch {}

      if (results.length === 0) {
        try {
          usedProvider = "DuckDuckGo Lite";
          results = await tryDuckDuckGoLite();
        } catch {}
      }

      if (results.length === 0) {
        try {
          usedProvider = "Brave Search";
          results = await tryBraveSearch();
        } catch {}
      }

      if (results.length === 0) {
        try {
          usedProvider = "Wikipedia";
          results = await tryWikipedia();
        } catch {}
      }

      return {
        query,
        count: results.length,
        provider: usedProvider,
        results:
          results.length > 0
            ? results
            : [
                {
                  title: `Query: ${query}`,
                  snippet:
                    "No direct search snippets found across search providers.",
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
