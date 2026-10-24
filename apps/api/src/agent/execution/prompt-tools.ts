export type ToolDoc = { name: string; desc: string }

export const DESKTOP_TOOLS: ToolDoc[] = [
  {
    name: "browser_navigate",
    desc: "Launches any URL in the desktop browser and opens the live preview sidebar for the user. Call this first when asked to visit, open, or view a website.",
  },
  {
    name: "take_screenshot",
    desc: "Captures the desktop, uploads it to storage, and returns an 'imageUrl'. Embed it as ![Screenshot](imageUrl) using ONLY the imageUrl returned by this tool in this conversation. Never output raw base64 or data URIs.",
  },
  {
    name: "view_screen",
    desc: "Captures the screen so YOU can inspect it (verify results, read errors, locate buttons). Does not open the user sidebar.",
  },
  {
    name: "show_screen",
    desc: "Opens the live desktop preview sidebar when the user asks to see the screen.",
  },
  {
    name: "mouse_click",
    desc: "Clicks at coordinates (x, y) or on an accessibility UI element.",
  },
  { name: "mouse_move", desc: "Moves the cursor to (x, y)." },
  { name: "mouse_scroll", desc: "Scrolls up or down at screen coordinates." },
  {
    name: "keyboard_type",
    desc: "Types text into the focused window or input field.",
  },
  {
    name: "browser_extract_content",
    desc: "Extracts visible windows and accessibility tree information.",
  },
  {
    name: "browser_wait_for_user",
    desc: "Human-in-the-loop pause for manual steps (2FA, login, payment, CAPTCHA). Opens the live preview with an instruction prompt.",
  },
  {
    name: "browser_close",
    desc: "Ends the desktop session. Call when browsing is finished and no human action is required.",
  },
]

export const TOOL_SECTIONS: { title: string; tools: ToolDoc[] }[] = [
  {
    title: "Shell, Filesystem & Generated Documents",
    tools: [
      {
        name: "create_downloadable_file",
        desc: "Saves generated content (text, data, code, documents) to storage and shows a download/preview card. For PDFs you can pass plain text or markdown and it is compiled automatically.",
      },
      {
        name: "save_and_share_file",
        desc: "Exports a file from the Daytona sandbox to downloadable storage and shows a file card.",
      },
      {
        name: "bash",
        desc: "Runs shell commands inside the Daytona sandbox (scripts, CLI tools, installs, compiling).",
      },
      {
        name: "read_file",
        desc: "Reads file contents from the sandbox filesystem.",
      },
      {
        name: "write_file",
        desc: "Creates or overwrites a text file in the sandbox filesystem.",
      },
      {
        name: "list_files",
        desc: "Lists files and directories in the sandbox filesystem.",
      },
      {
        name: "execute_code",
        desc: "Evaluates pure JavaScript expressions for quick data transforms or calculations.",
      },
    ],
  },
  {
    title: "Web Research & Live Intelligence",
    tools: [
      {
        name: "web_search",
        desc: "Live public web results via DuckDuckGo. Results are snippets: treat them as leads, not as complete facts.",
      },
      {
        name: "fetch_web_page",
        desc: "Extracts full text from a public web page. Fetch authoritative pages after searching instead of answering from snippets.",
      },
      {
        name: "http_request",
        desc: "Calls external REST APIs or webhooks (GET, POST, PUT, PATCH, DELETE).",
      },
      {
        name: "wikipedia_search",
        desc: "Encyclopedic facts, summaries, and biographies.",
      },
      { name: "get_weather", desc: "Live weather conditions and forecasts." },
      {
        name: "currency_converter",
        desc: "Foreign exchange conversions (USD, EUR, INR, GBP, etc.).",
      },
      {
        name: "dns_lookup",
        desc: "Resolves DNS records (A, AAAA, MX, TXT, CNAME).",
      },
    ],
  },
  {
    title: "Computation & Data Utilities",
    tools: [
      {
        name: "calculate",
        desc: "Evaluates math expressions. Use this for arithmetic instead of mental math.",
      },
      {
        name: "unit_converter",
        desc: "Converts length, weight, volume, temperature, and digital storage units.",
      },
      {
        name: "get_current_time",
        desc: "Returns the current time, date, weekday, year, and timezone offset. Call it when exact timing matters.",
      },
      {
        name: "json_parser",
        desc: "Extracts data from JSON using dot-notation.",
      },
      {
        name: "text_analyzer",
        desc: "Word/char counts, reading time, keyword distributions.",
      },
      {
        name: "transform_text",
        desc: "Case conversions, slugification, base64, URL encoding.",
      },
      {
        name: "generate_uuid",
        desc: "Generates UUIDv4 values and random tokens.",
      },
      {
        name: "random_generator",
        desc: "Dice rolls, coin flips, random integers, list shuffles.",
      },
    ],
  },
  {
    title: "Background Scheduling, Timers & Recurring Cron Tasks",
    tools: [
      {
        name: "create_recurring_task",
        desc: "Creates repeating background tasks (e.g. 'every day at 9am', 'weekdays', 'weekly summary'). Use it for any regular or recurring request. Accepts any standard timezone (e.g. 'Asia/Kolkata', 'IST', 'America/New_York'). Frequency: presets ('daily', 'hourly', 'weekdays', 'weekly', 'monthly') or 5-field cron strings (e.g. '0 9 * * *').",
      },
      {
        name: "create_schedule",
        desc: "Schedules one-off future tasks, delayed reminders, or alarms ('in 15 mins', 'at 5pm tomorrow').",
      },
      {
        name: "get_task_history",
        desc: "Shows scheduled execution history (what ran, status, outputs, times). Use it when the user asks 'did my task run?', 'what ran?', or 'show my task history'.",
      },
      {
        name: "list_active_schedules",
        desc: "Inspects currently running or planned recurring schedules and timers.",
      },
      {
        name: "cancel_schedule",
        desc: "Permanently cancels an active scheduled reminder or recurring cron job.",
      },
      {
        name: "toggle_schedule",
        desc: "Pauses or resumes a recurring schedule.",
      },
      {
        name: "update_schedule",
        desc: "Modifies the prompt or cron schedule of an existing task.",
      },
    ],
  },
  {
    title: "Long-term Memory & Chat History",
    tools: [
      {
        name: "search_memory",
        desc: "Retrieves stored long-term facts, preferences, user instructions, notes, and profile details across sessions.",
      },
      {
        name: "save_memory",
        desc: "Saves or updates durable facts, user preferences, tech stack choices, or instructions into persistent database memory.",
      },
      {
        name: "delete_memory",
        desc: "Removes outdated or irrelevant facts from long-term memory.",
      },
      {
        name: "get_chat_history",
        desc: "Inspects previous messages, user questions, code, or context at any point in the current conversation.",
      },
    ],
  },
  {
    title: "External SaaS Integrations (Composio) & MCP Tools",
    tools: [
      {
        name: "Composio Tools",
        desc: "GitHub, Slack, Gmail, Google Calendar, Notion, Linear, Jira, Twitter, and 200+ connected SaaS platforms.",
      },
      {
        name: "MCP Tools",
        desc: "External Model Context Protocol servers connected dynamically.",
      },
    ],
  },
]
