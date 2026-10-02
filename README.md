# OpenBots

An open-source autonomous multi-agent platform for building, orchestrating, and operating teams of specialized AI agents with durable tool execution, scheduled workflows, and third-party SaaS integrations.


https://github.com/user-attachments/assets/bc64f150-2b03-4c32-a173-38765f38f40c


## Overview

OpenBots provides a complete infrastructure stack for deploying autonomous agents in production. Agents operate with distinct system instructions, configurable reasoning models, loop boundaries, and access to a rich set of native utilities and SaaS integrations.

### Core Capabilities

- **Autonomous Agent Runtime**: Multi-step reasoning loops governed by the Vercel AI SDK (`ToolLoopAgent`) with bounded execution, structured tool calls, and error boundaries.
- **Durable Scheduling and Background Execution**: Delayed tasks, future timestamp execution, and recurring cron schedules powered by Trigger.dev and PostgreSQL persistence.
- **Extensible Tool Registry**: 17+ zero-dependency internal tools spanning network research, compute sandboxes, math, live weather, encyclopedic data, currency conversions, and DNS diagnostics.
- **SaaS Ecosystem via Composio and MCP**: Verified OAuth-managed access to Gmail, Google Sheets, Google Docs, Google Calendar, Google Drive, Outlook, Twitter (X), Slack, GitHub, Notion, Discord, Jira, Linear, Firecrawl, Hacker News, LinkedIn, ElevenLabs, Google Maps, PostHog, Stripe, and custom Model Context Protocol (MCP) servers.
- **Type-Safe Contract**: End-to-end type safety connecting Hono backend routes directly to the Next.js client via typed RPC contracts.
- **Authentication & Security**: Multi-tenant session security via Better Auth, strict database constraints, at-most-once atomic run claiming, and automated secret redaction for run traces.

---

## Architecture

```
                                  +------------------------------+
                                  |      Next.js Frontend        |
                                  |  (React 19 / App Router)     |
                                  +--------------+---------------+
                                                 |
                                     Typed RPC / REST API
                                                 |
                                  +--------------v---------------+
                                  |        Hono API Server       |
                                  |     (@openbots/api-contract) |
                                  +--------------+---------------+
                                                 |
                 +-------------------------------+-------------------------------+
                 |                                                               |
                 v                                                               v
  +------------------------------+                                +------------------------------+
  |    Direct Agent Executor     |                                |      Trigger.dev Worker      |
  |  (In-process fast path)      |                                |  (Durable background runs)   |
  +--------------+---------------+                                +--------------+---------------+
                 |                                                               |
                 +-------------------------------+-------------------------------+
                                                 |
                 +-------------------------------+-------------------------------+
                 |                               |                               |
                 v                               v                               v
  +------------------------------+ +---------------------------+ +-------------------------------+
  |        PostgreSQL DB         | |       Upstash Redis       | |       External Providers        |
  | (Agents, Runs, Steps, Auth)  | | (Pub/Sub & Event Caching) | | (Google AI, Composio, MCP)    |
  +------------------------------+ +---------------------------+ +-------------------------------+
```

---

## Tech Stack

| Domain                            | Technology                                                      |
| --------------------------------- | --------------------------------------------------------------- |
| **Frontend Framework**            | Next.js (App Router), React 19, TypeScript                      |
| **Styling & Components**          | Tailwind CSS v4, Radix/Base UI primitives, `@openbots/ui`       |
| **Server & Routing**              | Hono, `@hono/zod-validator`, Bun HTTP server                    |
| **Agent Reasoning Engine**        | Vercel AI SDK (`ai`), `@ai-sdk/google` (Gemini 2.5 Flash / Pro) |
| **Background & Scheduling**       | Trigger.dev v4 (durable tasks, delayed schedules, cron jobs)    |
| **Database & Persistence**        | PostgreSQL, Drizzle ORM (`@openbots/db`), Drizzle Kit           |
| **Cache & State Synchronization** | Upstash Redis / IORedis                                         |
| **Authentication**                | Better Auth (session cookies, email/password, RBAC)             |
| **Integrations**                  | Composio Platform SDK, Model Context Protocol (MCP)             |
| **Monorepo Tooling**              | Turborepo, Bun workspaces, Biome (linting & formatting)         |

---

## Repository Structure

```
openbots/
├── apps/
│   ├── web/                    # Next.js web application (workspaces, chat, tools, history)
│   └── api/                    # Bun HTTP service & Trigger.dev agent task executor
│
├── packages/
│   ├── api-contract/           # Shared Hono route declarations, Zod schemas, domain business logic
│   ├── api-client/             # End-to-end typed RPC client for the frontend
│   ├── db/                     # Drizzle ORM schemas, database migrations, connection client, Redis
│   ├── ui/                     # Reusable design system, UI components, and icons
│   └── typescript-config/      # Shared TypeScript configuration baselines
```

---

## Tool Registry

Agents can be configured with fine-grained tool permissions. When an agent executes a multi-step task, it dynamically selects appropriate tools to resolve the query.

### Internal Tools

| Tool Identifier      | Category     | Description                                                                                                   |
| -------------------- | ------------ | ------------------------------------------------------------------------------------------------------------- |
| `create_schedule`    | Automation   | Creates delayed executions (e.g. "in 10 minutes"), timestamp triggers, or recurring cron jobs.                |
| `get_weather`        | Intelligence | Fetches real-time weather conditions, humidity, wind, and multi-day forecasts for any city via Open-Meteo.    |
| `wikipedia_search`   | Research     | Direct encyclopedia search retrieving article extracts, conceptual summaries, and canonical links.            |
| `currency_converter` | Utilities    | Converts monetary values with real-time global foreign exchange rates (USD, EUR, INR, GBP, etc.).             |
| `dns_lookup`         | Diagnostics  | Performs DNS record queries (`A`, `AAAA`, `MX`, `TXT`, `CNAME`, `NS`) using Google Public DNS over HTTPS.     |
| `web_search`         | Research     | Real-time public web search returning result titles, snippets, and source links via DuckDuckGo.               |
| `fetch_web_page`     | Extraction   | Fetches and cleans readable text, articles, or JSON documentation from any public URL.                        |
| `http_request`       | Integration  | Executes arbitrary REST API calls (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) with custom headers and payloads. |
| `execute_code`       | Computing    | Evaluates JavaScript/TypeScript code snippets in an isolated, safe execution context.                         |
| `get_current_time`   | Utilities    | Returns ISO timestamps, local timezone offsets, and granular calendar structures.                             |
| `calculate`          | Utilities    | Safely evaluates arithmetic expressions (`+`, `-`, `*`, `/`, `%`, `^`, parentheses) without `eval`.           |
| `unit_converter`     | Utilities    | Converts length, weight, volume, temperature, and digital storage units.                                      |
| `transform_text`     | Utilities    | String transformations (uppercase, lowercase, camelCase, snake_case, base64, URL encoding, slugify).          |
| `generate_uuid`      | Utilities    | Cryptographically secure UUIDv4 identifiers, hex tokens, and numeric PINs.                                    |
| `json_parser`        | Utilities    | Parses raw JSON text and queries nested dot-notation paths.                                                   |
| `text_analyzer`      | Utilities    | Computes word counts, character counts, readability statistics, and keyword frequency maps.                   |
| `random_generator`   | Utilities    | Generates random numbers, picks from choices, flips coins, rolls dice, or shuffles lists.                     |

### SaaS & Third-Party Integrations (Composio)

Integrations can be authorized per-user via Composio's managed connection layer:

- **Productivity & Docs**: Gmail, Google Calendar, Google Drive, Google Docs, Google Sheets, Outlook, Notion.
- **Developer & Engineering**: GitHub, Jira, Trello, Asana, Linear, PostHog.
- **Social, Messaging & Content**: Slack, Discord, Twitter (X), LinkedIn, YouTube, Hacker News.
- **Media, Audio & Geo**: ElevenLabs, Google Maps, Zoom, Firecrawl, Stripe.

---

## Getting Started

### Prerequisites

- **Runtime**: [Bun](https://bun.sh/) >= 1.2.0
- **Database**: PostgreSQL (local or hosted via Supabase, Neon, AWS RDS)
- **Node.js**: Node 20+ (for Next.js dev server tooling)
- **API Keys**:
  - `GEMINI_API_KEY` (required for Google Gemini models)
  - `TRIGGER_SECRET_KEY` & `TRIGGER_PROJECT_REF` (required for durable background runs)
  - `COMPOSIO_API_KEY` (optional, for third-party SaaS tool execution)
  - `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` (optional, for distributed cross-process pub/sub)

---

### Installation

Clone the repository and install all monorepo dependencies:

```bash
git clone https://github.com/your-org/openbots.git
cd openbots
bun install
```

---

### Environment Setup

Create the root configuration `.env` file (or copy from `.env.example`):

```bash
# PostgreSQL Connection String
DATABASE_URL="postgresql://user:password@localhost:5432/openbots"

# LLM Providers
GEMINI_API_KEY="AIzaSy..."

# Trigger.dev Credentials
TRIGGER_SECRET_KEY="tr_dev_..."
TRIGGER_PROJECT_REF="proj_..."

# Better Auth Session Secret
BETTER_AUTH_SECRET="your-32-character-random-secret"
BETTER_AUTH_URL="http://localhost:3000"

# Composio Integration Platform (Optional)
COMPOSIO_API_KEY="ak_..."

# Upstash Redis (Optional for distributed pub/sub)
UPSTASH_REDIS_REST_URL="https://...upstash.io"
UPSTASH_REDIS_REST_TOKEN="..."
```

Also verify `apps/web/.env.local`:

```bash
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

---

### Database Migration

Push schemas directly to your PostgreSQL database using Drizzle:

```bash
# Push schemas to PostgreSQL
cd packages/db
bun run db:push

# Optional: Open visual Drizzle Studio database GUI
bun run db:studio
```

---

### Running the Development Environment

Start all applications and background workers concurrently using Turborepo:

```bash
# From repository root
bun run dev
```

Alternatively, services can be launched individually:

```bash
# 1. API Server (Port 3001)
cd apps/api && bun run dev

# 2. Next.js Web Frontend (Port 3000)
cd apps/web && bun run dev

# 3. Trigger.dev Background Worker
cd apps/api && bun x @trigger.dev/cli@latest dev
```

The web application is accessible at `http://localhost:3000`.

---

## Monorepo Scripts

| Command             | Action                                                     |
| ------------------- | ---------------------------------------------------------- |
| `bun run dev`       | Starts all applications in watch mode via Turborepo        |
| `bun run build`     | Compiles packages and generates Next.js production bundles |
| `bun run typecheck` | Runs `tsc --noEmit` across all 7 workspace packages        |
| `bun run lint`      | Runs Biome code analysis and checks formatting             |
| `bun run format`    | Applies Biome formatting across the monorepo               |
| `bun run check`     | Checks and fixes linting and formatting issues             |

---

## Production Deployment

### API Server (`apps/api`)

The API service runs natively on Bun or Node.js containers:

```bash
cd apps/api
bun run build
NODE_ENV=production bun run start
```

### Web Application (`apps/web`)

The Next.js frontend can be deployed to Vercel, AWS ECS, or any container runtime:

```bash
cd apps/web
bun run build
bun run start
```

### Database & Background Jobs

1. Apply database migrations: `bun run --filter @openbots/db db:push`
2. Deploy Trigger.dev tasks: `cd apps/api && bun x @trigger.dev/cli@latest deploy`

---

## Security & Reliability

- **At-Most-Once Execution Guarantee**: Claims agent runs atomically using database transaction locks (`UPDATE runs SET status = 'running' WHERE id = ... AND status = 'queued'`) to prevent split-brain worker races.
- **Sensitive Data Sanitization**: Execution logs automatically mask API keys, database connection URIs, and authorization tokens before writing run steps to storage.
- **Isolated Compute**: Custom script evaluation tools run in non-privileged scopes without access to host file systems, network sockets, or process environments.

---

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
