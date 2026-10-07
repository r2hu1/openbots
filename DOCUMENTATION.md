# OpenBots Technical Documentation & Architecture Reference

This document provides a comprehensive technical overview of the OpenBots architecture, execution lifecycles, monorepo packages, database schemas, tool engine, and production operations.

For a non-technical walkthrough of user features, see [README.md](README.md).  
For deployment and self-hosting instructions, see [SELF_HOST.md](SELF_HOST.md).

---

## 1. System Architecture

OpenBots is designed around clean boundaries separating presentation, RPC contracts, durable agent runtimes, and persistence.

```
                              +------------------------------+
                              |      Next.js Frontend        |
                              |   (React 19 / App Router)    |
                              +--------------+---------------+
                                             |
                                 Typed RPC (Hono hc Client)
                                             |
                              +--------------v---------------+
                              |        Hono API Server       |
                              |     (@openbots/api-contract) |
                              +--------------+---------------+
                                             |
             +-------------------------------+-------------------------------+
             |                                                               |
             v                                                               v
+------------------------------+                               +------------------------------+
|    Direct Agent Executor     |                               |   Trigger.dev v4 Worker      |
|    (In-process fast path)    |                               |   (Durable background tasks) |
+--------------+---------------+                               +--------------+---------------+
             |                                                               |
             +-------------------------------+-------------------------------+
                                             |
             +-------------------------------+-------------------------------+
             |                               |                               |
             v                               v                               v
+------------------------------+ +---------------------------+ +-------------------------------+
|        PostgreSQL DB         | |    Redis / Upstash PubSub | |       External Providers        |
| (Agents, Runs, Steps, Auth)  | | (Ephemeral Run Streaming) | | (Google AI, Composio, MCP)    |
+------------------------------+ +---------------------------+ +-------------------------------+
```

### Execution Pathways

1. **Interactive Fast Path (Direct Agent Executor)**:
   - Synchronous user queries in chat sessions are handled by the API server in `apps/api` using the Vercel AI SDK `ToolLoopAgent`.
   - Streaming tokens and tool execution steps are buffered and streamed to the Next.js client with low latency.
   - Run claiming uses optimistic updates and database transactions to avoid split-brain execution.

2. **Durable Asynchronous Path (Trigger.dev v4)**:
   - Scheduled tasks, delayed reminders, and recurring cron jobs are dispatched to Trigger.dev (`apps/api/src/trigger`).
   - Tasks survive service restarts and process crashes, executing with automatic exponential backoff retries.
   - The worker resolves schedules by ID, queries database context, instantiates the agent runtime, and persists run history.

---

## 2. Monorepo Structure & Package Boundaries

Managed with **Bun Workspaces** and **Turborepo**:

```
openbots/
├── apps/
│   ├── web/                    # Next.js 16 (App Router, React 19, Tailwind CSS v4)
│   └── api/                    # Bun HTTP service (Hono) & Trigger.dev background task worker
│
├── packages/
│   ├── api-contract/           # Shared Hono route declarations, Zod schemas, tools & domain logic
│   ├── api-client/             # End-to-end typed RPC client used by the frontend
│   ├── db/                     # Drizzle ORM schemas, PostgreSQL connection, Redis client
│   ├── ui/                     # Shared design system, UI components, Blobatars & typography
│   └── typescript-config/      # Shared TypeScript base configurations
│
├── README.md                   # Product walkthrough and feature overview
├── SELF_HOST.md                # Complete self-hosting and production operations guide
├── DOCUMENTATION.md            # Technical specifications (this document)
└── turbo.json                  # Monorepo build and task pipeline
```

### Package Roles & Dependencies

- **`@openbots/api-contract`**:
  - Contains endpoints, request/response schemas, validation rules (`@hono/zod-validator`), and the built-in tool registry (`packages/api-contract/src/tools`).
  - Serves as the single source of truth for both server implementation and client typing.
- **`@openbots/api-client`**:
  - Wraps Hono's RPC client (`hc<AppType>`). Provides client-side types for all endpoints without requiring code-generation steps.
- **`@openbots/db`**:
  - Drizzle ORM PostgreSQL schema definitions (`packages/db/src/schemas`).
  - Implements database connection management, migrations, and dual Redis client supporting both self-hosted `ioredis` and serverless `@upstash/redis`.
- **`@openbots/ui`**:
  - Shared design primitives built on Base UI / Radix primitives, Tailwind CSS v4, Lucide/Tabler/Reicon iconography, and interactive `@blobatar/react` avatar components.

---

## 3. Technology Stack & Key Dependencies

| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Package Manager / Runtime** | Bun | `>= 1.2` | Monorepo dependency management and API runtime |
| **Frontend Framework** | Next.js (App Router) | `16.3.6` | Web application interface |
| **UI Library** | React | `19.2.8` | Client rendering engine |
| **Styling** | Tailwind CSS | `v4` | Modern CSS design tokens and layout |
| **API Framework** | Hono | `^4.7.11` | High-performance, lightweight HTTP server |
| **Agent Reasoning Engine** | Vercel AI SDK (`ai`) | `^7.0.0` | Multi-step agent loop (`ToolLoopAgent`) |
| **LLM Provider** | Google Gemini (`@ai-sdk/google`) | `^4.0.0` | Multi-modal reasoning & vision inputs |
| **Background Engine** | Trigger.dev v4 | `4.7.3` | Durable execution & cron task scheduling |
| **Database ORM** | Drizzle ORM | `^0.45.3` | Type-safe PostgreSQL mapping & migrations |
| **Cache / Queue** | Redis (`ioredis` / Upstash) | `^6.0.0` | Ephemeral run state & agent event pub/sub |
| **Authentication** | Better Auth | `^1.7.7` | Session cookies, email/password, RBAC |
| **SaaS Tooling** | Composio Platform | `^0.22.0` | 200+ managed OAuth integrations |

---

## 4. Agent Execution Lifecycle & Presentation Layer

### Reasoning Loop (`ToolLoopAgent`)
1. User prompt (plus optional multimodal image attachments) is received.
2. Agent context (instructions, system prompt, enabled tools) is assembled.
3. The reasoning model evaluates the goal and produces structured tool invocations.
4. Each tool call is executed against the internal tool registry, Composio SDK, or configured MCP servers.
5. Tool results are fed back into the reasoning loop until the model generates the final text or an artifact.

### Human-Readable Activity Stream
Rather than rendering raw tool invocations directly in the chat UI, OpenBots normalizes steps via `apps/web/modules/runs/activity-stream.ts`:
- **Categorization**: Classifies operations into semantic domains (`research`, `code`, `document`, `communication`, `schedule`, `data`, `action`).
- **Grouping**: Consecutive related actions (e.g. multiple search queries and web scrapes) are aggregated into coherent goals:
  - *"Researching"* &rarr; *"4 sources analyzed"*
  - *"Created the report"* &rarr; *"report.md"*
  - *"Sent the email"* &rarr; *"To the requested recipient"*
- **Sanitized Technical Trace**: The expandable "Details" disclosure gives full technical visibility (tool name, sanitized input, sanitized output) while redacting tokens, keys, and internal secrets.

---

## 5. Built-in Tool Registry

All internal tools are declared in `packages/api-contract/src/tools`:

| Tool Identifier | Implementation Category | Functionality |
| :--- | :--- | :--- |
| `create_schedule` | Durable Background | Dispatches delayed triggers or cron tasks to Trigger.dev |
| `get_weather` | Intelligence | Fetches real-time meteorological forecasts via Open-Meteo |
| `wikipedia_search` | Research | Queries Wikipedia extracts and conceptual summaries |
| `currency_converter`| Utilities | Real-time global exchange rates across 160+ fiat currencies |
| `dns_lookup` | Diagnostics | Resolves A, AAAA, MX, TXT, CNAME records via Google DNS-over-HTTPS |
| `web_search` | Research | Live web queries with titles, URLs, and snippets via DuckDuckGo |
| `fetch_web_page` | Extraction | Headless HTTP extraction and Markdown cleaning of web pages |
| `http_request` | Integration | Arbitrary HTTP requests with configurable methods and headers |
| `execute_code` | Compute Sandbox | Sandboxed JavaScript/TypeScript execution runtime |
| `get_current_time` | Utilities | Accurate ISO timestamps and timezone-aware calculations |
| `calculate` | Utilities | Safe math expression evaluation without `eval()` |
| `unit_converter` | Utilities | Dimension and metric conversions (length, weight, digital units) |
| `transform_text` | Utilities | String case conversion, hashing, base64, slugification |
| `generate_uuid` | Utilities | Cryptographically secure UUIDv4 identifiers and random tokens |
| `json_parser` | Utilities | JSON structure navigation and dot-path queries |
| `text_analyzer` | Utilities | Linguistic metrics, token counts, and keyword frequencies |
| `random_generator` | Utilities | Secure random selections, dice rolling, and array shuffling |

### SaaS & External Integrations (Composio & MCP)
- When enabled, agents can invoke Composio tools across Gmail, Google Docs/Sheets/Calendar, Slack, GitHub, Linear, Discord, Notion, Jira, and Twitter.
- Model Context Protocol (MCP) clients can be attached dynamically to allow agents to interact with custom corporate databases and internal enterprise microservices.

---

## 6. Database Schema & Persistence

Database models are declared in `packages/db/src/schemas/`:

### Core Tables
- **`agents`**: Agent configuration (system prompt, temperature, model identifier, enabled tools list, user ID).
- **`conversations`**: Chat thread sessions belonging to a specific agent and user.
- **`messages`**: Individual messages (user, assistant, tool calls, and multimodal attachment metadata).
- **`runs`**: Execution runs triggered by an agent. Tracks run status (`queued`, `running`, `completed`, `failed`), timestamps, and error codes.
- **`run_steps`**: Granular execution steps detailing model thoughts, tool calls, input parameters, and output results.
- **`schedules`**: Scheduled tasks with cron strings, target run timestamps, repeat configurations, and Trigger.dev schedule IDs.
- **`users`, `sessions`, `accounts`, `verifications`**: Better Auth tables managing authentication, OAuth tokens, and sessions.

### Drizzle CLI Commands
```bash
# Push schema changes directly to the database
cd packages/db
bun run db:push

# Generate migration files
bun run db:generate

# Execute pending migrations
bun run db:migrate

# Launch visual Drizzle Studio schema explorer
bun run db:studio
```

---

## 7. Development & Monorepo Tooling

| Task | Command | Description |
| :--- | :--- | :--- |
| **Dev Mode** | `bun run dev` | Runs web and API concurrently with hot reloading via Turborepo |
| **Build** | `bun run build` | Compiles packages and creates Next.js and API production builds |
| **Type Check** | `bun run typecheck` | Validates TypeScript across all 7 workspace packages |
| **Lint** | `bun run lint` | Runs Biome code diagnostics |
| **Format** | `bun run format` | Enforces repository-wide Biome formatting rules |
| **Check** | `bun run check` | Combines linting and formatting verification |
| **Trigger Dev**| `cd apps/api && bun run trigger:dev` | Runs Trigger.dev local background task worker |

---

## 8. Security & Production Hardening

- **Atomic Run Locks**: Prevents split-brain execution across multiple worker nodes using SQL transaction locks.
- **Trace Masking & Sanitization**: Redacts API keys, database credentials, Authorization headers, and bearer tokens before saving steps to persistent storage.
- **Multi-Tenant Isolation**: Enforces user-scoped foreign keys across all agent, run, schedule, and conversation queries.
- **Secret Separation**: Configuration and API credentials are kept strictly out of client bundles; only `NEXT_PUBLIC_*` variables are exposed to the browser.
