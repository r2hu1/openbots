export const TOOL_DESCRIPTIONS: Record<string, string> = {
  get_current_time: "Provides real-time timestamp and timezone calculations.",
  calculate:
    "Evaluates mathematical expressions safely without code evaluation.",
  create_schedule:
    "Creates delayed, relative, timestamped, or recurring scheduled runs.",
  web_search:
    "Performs live web searches with snippets and source links via DuckDuckGo.",
  fetch_web_page:
    "Extracts readable text content and articles from public web pages.",
  http_request:
    "Makes direct REST API calls (GET, POST, PUT, DELETE) to any webhook or URL.",
  json_parser:
    "Parses, queries, and extracts specific fields from JSON payloads.",
  text_analyzer:
    "Calculates word counts, line counts, readability, and key terms.",
  execute_code:
    "Executes safe JavaScript/TypeScript logic, transformations, or data algorithms.",
  generate_uuid:
    "Generates cryptographic UUIDs, unique session tokens, or numeric IDs.",
  transform_text:
    "Transforms text formats: case conversion, Base64/URL encoding, slugify, or reverse.",
  unit_converter:
    "Converts metric, imperial, temperature, weight, volume, or digital storage units.",
  random_generator:
    "Generates random numbers, picks from choices, rolls dice, or shuffles lists.",
  get_weather:
    "Fetches live real-time weather, temperature, humidity, wind, and multi-day forecasts.",
  wikipedia_search:
    "Searches Wikipedia for articles, facts, biographies, concepts, and encyclopedia summaries.",
  currency_converter:
    "Fetches live global foreign exchange rates and converts currency amounts.",
  dns_lookup:
    "Performs DNS record lookups (A, AAAA, MX, TXT, CNAME, NS) via Google Public DNS.",
};

export const DEFAULT_MODELS = [
  { id: "google/gemini-2.5-flash", displayName: "Gemini 2.5 Flash" },
  { id: "google/gemini-2.5-pro", displayName: "Gemini 2.5 Pro" },
  { id: "google/gemini-2.0-flash", displayName: "Gemini 2.0 Flash" },
];
