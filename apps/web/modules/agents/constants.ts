export const TOOL_DESCRIPTIONS: Record<string, string> = {
  get_current_time: "Provides real-time timestamp and timezone calculations.",
  calculate:
    "Evaluates mathematical expressions safely without code evaluation.",
  create_schedule:
    "Creates delayed, relative, timestamped, or recurring scheduled runs.",
  manage_schedule:
    "Lists, modifies, reschedules, or cancels queued reminders and recurring tasks.",
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
  bash:
    "Executes shell commands in the Daytona sandbox terminal to run scripts, compile code, or manage processes.",
  read_file:
    "Reads file contents directly from the Daytona sandbox filesystem.",
  write_file:
    "Writes or modifies files in the Daytona sandbox filesystem.",
  list_files:
    "Lists directory contents and file metadata inside the Daytona sandbox.",
  mouse_click:
    "Clicks the mouse at screen coordinates (x, y) or on an accessibility UI element in the desktop.",
  mouse_move:
    "Moves the mouse cursor to specified coordinates on the desktop screen.",
  mouse_scroll:
    "Scrolls the mouse wheel up or down at screen coordinates.",
  keyboard_type:
    "Types text into the active focused window or input field on the desktop.",
  view_screen:
    "Captures the desktop screen for the agent's internal visual inspection (without opening user sidebar).",
  show_screen:
    "Opens the live desktop preview sidebar so the user can watch the screen or interact.",
  take_screenshot:
    "Captures a visual screenshot of the current Daytona desktop.",
  browser_navigate:
    "Opens and navigates to any URL in a full real cloud desktop browser powered by Daytona.",
  browser_click:
    "Clicks buttons, links, dropdowns, and interactive elements on the web page or desktop.",
  browser_type:
    "Fills forms and types inputs, search queries, and credentials in the desktop browser.",
  browser_screenshot:
    "Captures full visual screenshots and live view sessions of the Daytona desktop.",
  browser_extract_content:
    "Extracts structured article text, clean content, and accessibility tree data.",
  browser_scroll:
    "Scrolls web pages or desktop windows up or down.",
  browser_evaluate:
    "Runs shell commands or scripts directly in the Daytona sandbox environment.",
  browser_wait_for_user:
    "Pauses agent execution to allow the human user to interact directly in the live desktop preview (e.g. login, solve CAPTCHA, 2FA).",
  browser_close:
    "Stops desktop computer use processes in the Daytona sandbox.",
};

export const DEFAULT_MODELS = [
  { id: "google/gemini-2.5-flash", displayName: "Gemini 2.5 Flash" },
  { id: "google/gemini-2.5-pro", displayName: "Gemini 2.5 Pro" },
  { id: "google/gemini-2.0-flash", displayName: "Gemini 2.0 Flash" },
];
