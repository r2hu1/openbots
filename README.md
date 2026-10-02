# OpenBots

OpenBots lets you build, configure, and operate a team of specialized AI agents. Give each agent a distinct role, instructions, autonomy level, and toolset. Connect them to your everyday apps (Gmail, Notion, Slack, GitHub, and more) or let them run local and scheduled automations on your behalf.

---

### Highlights

- 🤖 **Multi-Agent Orchestration** — Create custom agents with dedicated instructions, system prompts, models, and execution boundaries.
- 🧠 **Flexible Intelligence** — Powered by the Vercel AI SDK and extensible provider support.
- 🛠️ **13+ Built-in Standard Tools** — Web search, page extraction, arbitrary HTTP requests, sandboxed JavaScript code execution, mathematical calculations, unit conversion, text analysis, UUID & token generation, JSON parsing, and more.
- ⏰ **Automated Scheduling** — Native Trigger.dev integration for relative delays (`"in 2 minutes"`), specific timestamps, and recurring cron schedules.
- 🔌 **Composio & MCP Ecosystem** — OAuth integrations with Gmail, Notion, Slack, GitHub, Linear, Google Calendar, Discord, Jira, and custom Model Context Protocol (MCP) servers.
- ⚡ **Real-Time Interactive UI** — Ultra-smooth optimistic messaging, live step-by-step tool inspection, thinking indicators, and robust error recovery.
- 🔒 **Secure by Default** — Session authentication powered by Better Auth, environment variable sanitization, and at-most-once atomic run claiming.
- 🏠 **Self-Hostable & Open** — Fully open-source monorepo built with Bun, Next.js, Hono, Drizzle ORM, and PostgreSQL.

---

## Tech Stack

| Layer                  | Technologies                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Frontend**           | [Next.js](https://nextjs.org/) (App Router), React 19, Tailwind CSS v4, shadcn/ui                                |
| **API & RPC**          | [Hono](https://hono.dev/) with end-to-end typed client RPC                                                       |
| **Agent Engine**       | [Vercel AI SDK](https://sdk.vercel.ai/) (`ToolLoopAgent`), Google Generative AI                                  |
| **Background Jobs**    | [Trigger.dev](https://trigger.dev/) (durable async execution & delayed scheduling)                               |
| **Database & Cache**   | PostgreSQL, [Drizzle ORM](https://orm.drizzle.team/), Upstash Redis                                              |
| **Auth**               | [Better Auth](https://better-auth.com/) (email/password & sessions)                                              |
| **SaaS Tools**         | [Composio](https://composio.dev/) Platform SDK, Model Context Protocol ([MCP](https://modelcontextprotocol.io/)) |
| **Runtime & Monorepo** | [Bun](https://bun.sh/) ≥ 1.2, [Turborepo](https://turbo.build/)                                                  |

---

## Project Structure

```
openbots/
├── apps/
│   ├── web/                 → Next.js frontend (workspace UI, agent chat, settings)
│   └── api/                 → Bun HTTP server & Trigger.dev agent runner tasks
│
├── packages/
│   ├── api-contract/        → Hono route definitions, Zod validation, domain logic
│   ├── api-client/          → Strongly-typed RPC client consumed by web app
│   ├── db/                  → Drizzle ORM schema, migrations, connection pool, Redis
│   ├── ui/                  → Shared component library (shadcn primitives, icons)
│   └── typescript-config/   → Centralized TypeScript configurations
```

---

## Built-in Tools

Agents can be configured with any combination of standard internal tools, SaaS apps, and MCP servers:

| Tool                   | Category    | Capabilities                                                                                 |
| ---------------------- | ----------- | -------------------------------------------------------------------------------------------- |
| **`create_schedule`**  | Automation  | Triggers delayed executions (e.g. "remind me in 5 minutes"), alarms, and recurring cron jobs |
| **`web_search`**       | Research    | Live public web searches with snippets & source links via DuckDuckGo                         |
| **`fetch_web_page`**   | Research    | Extracts readable text, documentation, or JSON data from any public URL                      |
| **`http_request`**     | Integration | Makes custom `GET`, `POST`, `PUT`, `PATCH`, or `DELETE` API requests                         |
| **`execute_code`**     | Computing   | Evaluates sandboxed JavaScript/TypeScript expressions for logic and data processing          |
| **`get_current_time`** | Utilities   | Real-time timestamps, calendar components, and timezone calculations                         |
| **`calculate`**        | Utilities   | Arithmetic expressions parser without code execution                                         |
| **`unit_converter`**   | Utilities   | Converts metric, imperial, temperature, weight, volume, and data sizes                       |
| **`transform_text`**   | Utilities   | Case formatting (camelCase, snake_case), Base64/URL encoding, slugification                  |
| **`generate_uuid`**    | Utilities   | Cryptographic UUIDs, API tokens, and numeric PINs                                            |
| **`json_parser`**      | Utilities   | Parses and queries specific dot-notation paths from JSON payloads                            |
| **`text_analyzer`**    | Analysis    | Word count, character count, readability, and keyword frequency map                          |
| **`random_generator`** | Utilities   | Random numbers in range, choice picker, dice roller, and array shuffler                      |
| **Composio Apps**      | SaaS        | Gmail, Notion, Slack, GitHub, Google Calendar, Discord, Jira, etc.                           |

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) ≥ 1.2
- [PostgreSQL](https://www.postgresql.org/) (or a [Supabase](https://supabase.com/) project)
- [Trigger.dev](https://trigger.dev/) account (for background task execution & delayed runs)
- _(Optional)_ [Composio](https://composio.dev/) API key (for connected third-party SaaS apps)
- _(Optional)_ [Google AI Studio](https://aistudio.google.com/) API key (for Gemini models)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/openbots.git
cd openbots

# Install dependencies across all monorepo packages
bun install
```

### Environment Configuration

Configure `.env` in the root or package directories:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/openbots"

# LLM Providers
GEMINI_API_KEY="your-gemini-api-key"

# Trigger.dev (Background execution & timers)
TRIGGER_SECRET_KEY="tr_dev_your_secret_key"
TRIGGER_PROJECT_REF="your-project-ref"

# Composio (Optional: Third-party apps like Gmail, Slack, Notion)
COMPOSIO_API_KEY="your-composio-api-key"

# Frontend (apps/web/.env.local)
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

### Database Setup

```bash
cd packages/db
bun run db:push       # Push Drizzle schema to your PostgreSQL database
bun run db:studio     # (Optional) Open Drizzle Studio web GUI
```

### Running Locally

Run both the API and Web apps in development mode:

```bash
# Start all services concurrently via Turborepo
bun run dev

# Or start services individually:
# API server (port 3001)
cd apps/api && bun run dev

# Next.js web application (port 3000)
cd apps/web && bun run dev

# Trigger.dev dev worker (for task execution)
cd apps/api && bun x @trigger.dev/cli@latest dev
```

---

## Monorepo Commands

```bash
bun run dev         # Start all applications in watch mode
bun run build       # Build all packages and applications
bun run typecheck   # Typecheck TypeScript across all 6 packages
bun run lint        # Lint files with Biome
bun run format      # Format codebase with Biome
```

---

## License

OpenBots is open-source software licensed under the [MIT License](./LICENSE).
