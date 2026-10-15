# OpenBots Architecture

## Package Overview

```
apps/
  web/              → Next.js frontend
  api/              → Thin Bun HTTP server (deployment entrypoint only)

packages/
  api-contract/     → Hono app, domain routes, schemas, logic (reusable implementation)
  api-client/       → Typed hc<AppType>() client for frontend consumption
  db/               → Drizzle ORM + PostgreSQL + Upstash Redis (server-only)
  ui/               → Shared React components
```

## Dependency Graph

```
apps/web ──→ @openbots/api-client ──→ @openbots/api-contract ──→ @openbots/db

apps/api ──→ @openbots/api-contract ──→ @openbots/db
```

**Hard rules:**
- `apps/web` never imports from `apps/api` or `@openbots/db`
- `apps/api` is a thin deployment entrypoint — all logic lives in `@openbots/api-contract`
- `@openbots/api-client` is browser-safe
- `@openbots/api-contract` and `@openbots/db` are server-only
- All secrets are server-only — never in `NEXT_PUBLIC_*`

## Database Architecture (`packages/db`)

### Entity-Relationship Model

```
User (Better Auth)
│
├── Agents
│    │
│    ├── Agent Tools
│    │
│    └── Runs
│         │
│         └── Run Steps
│
├── Connections
│
└── Conversations
     │
     ├── Messages
     │
     └── Runs
```

### Tables

| Table | File | Description | Primary Key | Foreign Keys |
|---|---|---|---|---|
| `user` | `auth.ts` | Better Auth user table | `id` (text) | — |
| `session` | `auth.ts` | Better Auth sessions | `id` (text) | `userId` → `user.id` |
| `account` | `auth.ts` | Better Auth OAuth accounts | `id` (text) | `userId` → `user.id` |
| `verification` | `auth.ts` | Better Auth tokens | `id` (text) | — |
| `agents` | `agents.ts` | Persistent AI agent definition & config | `id` (uuid) | `userId` → `user.id` |
| `agent_tools` | `agent-tools.ts` | Allowed tools per agent | `id` (uuid) | `agentId` → `agents.id` |
| `connections` | `connections.ts` | User external app connections (no secrets) | `id` (uuid) | `userId` → `user.id` |
| `conversations` | `conversations.ts` | Conversations between user & agent | `id` (uuid) | `userId` → `user.id`, `agentId` → `agents.id` |
| `messages` | `messages.ts` | Conversation messages (JSONB content for multi-part) | `id` (uuid) | `conversationId` → `conversations.id` |
| `runs` | `runs.ts` | Execution instance of an agent | `id` (uuid) | `userId` → `user.id`, `agentId` → `agents.id`, `conversationId` → `conversations.id` |
| `run_steps` | `run-steps.ts` | Individual model or tool execution steps | `id` (uuid) | `runId` → `runs.id` |

### Key Constraints & Indexes

- **Enums:** `agent_status` (active/paused/archived), `agent_autonomy` (manual/approved/autonomous), `agent_tool_provider` (internal/composio/mcp), `connection_status` (active/disconnected/error), `message_role` (system/user/assistant/tool), `run_status` (queued/running/waiting/completed/failed/cancelled), `run_trigger_type` (manual/schedule/event/webhook), `run_step_type` (model/tool), `run_step_status` (running/completed/failed)
- **Unique constraints:**
  - `agent_tools`: `(agent_id, tool_name)`
  - `connections`: `(user_id, provider, external_account_id)`
  - `run_steps`: `(run_id, step_number)`
- **Indexes:**
  - Every user-owned table has an index on `user_id`
  - `agents`: `user_id`
  - `agent_tools`: `agent_id`
  - `connections`: `user_id`
  - `conversations`: `user_id`, `agent_id`
  - `messages`: `(conversation_id, created_at)`
  - `runs`: `user_id`, `agent_id`, `conversation_id`, `status`, `created_at`
  - `run_steps`: `(run_id, step_number)`

### Migrations

```bash
cd packages/db
bun run db:generate    # Generate migrations into drizzle/
bun run db:migrate     # Apply migrations
bun run db:push        # Push schema directly (dev)
bun run db:studio      # Open Drizzle Studio
```

Current migrations:
- `0000_enable_pgvector.sql` — PostgreSQL vector extension initialization
- `0001_luxuriant_roulette.sql` — OpenBots core product schema (all tables, enums, FKs, indexes, constraints)

## Route Organization

Each domain follows a three-file convention inside `packages/api-contract/src/routes/`:

```
routes/
├── agents/
│   ├── agents.schema.ts    ← Zod schemas, types, enums
│   ├── agents.route.ts     ← Hono route definitions
│   └── agents.logic.ts     ← Domain/application logic
├── tasks/
├── runs/
└── connections/
```

- **`*.schema.ts`** — request/response validation and public data schemas
- **`*.route.ts`** — Hono route handlers, HTTP concerns, middleware
- **`*.logic.ts`** — domain logic called by routes; database access goes here

Route handlers delegate to the logic layer. The logic layer uses `@openbots/db` for persistence.

## Infrastructure

### Database — Supabase PostgreSQL + Drizzle

Primary persistent storage. Managed through `packages/db`.

- **ORM:** Drizzle with `postgres.js` driver
- **Connection:** `DATABASE_URL` environment variable
- **pgvector:** Extension enabled via migration — ready for future vector/semantic memory
- **Schemas:** `packages/db/src/schemas/`
- **Migrations:** `packages/db/drizzle/`

### Redis — Upstash

Server-side ephemeral infrastructure in `packages/db/src/redis/`. Uses HTTP-based Upstash client.

Intended for caching, rate limiting, distributed locks, and short-lived execution state. Not a source of truth for persistent data.

- **Client:** `@upstash/redis` (REST-based, works in all runtimes)
- **Connection:** `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
- **Access:** `import { getRedis } from "@openbots/db/redis"`

### AI — Vercel AI SDK (Gemini)

LLM runtime via the `ai` package with `@ai-sdk/google` provider running in `apps/api/src/agent/`.

The AI SDK provides `ToolLoopAgent` for autonomous multi-step tool-calling execution loops with configurable `stepCountIs(maxSteps)` stopping conditions.

- **Provider:** `@ai-sdk/google` (Google Generative AI / Gemini)
- **Default Model:** `google/gemini-2.5-flash`
- **Connection:** `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`

### Authentication — Better Auth

Server-side authentication in `packages/api-contract/src/lib/auth.ts`. Uses the Drizzle adapter with the existing PostgreSQL database.

Auth handler is mounted on the Hono app at `/api/auth/*`.

- **Connection:** `BETTER_AUTH_SECRET` + `BETTER_AUTH_URL`
- **Verify:** `GET /api/auth/ok` should return `{ status: "ok" }`

### Composio — External Integrations

Server-side integration layer in `packages/api-contract/src/lib/composio.ts`. Uses `@composio/core` with `@composio/vercel` for AI SDK compatibility.

Handles OAuth connections, tool discovery, and tool execution for external apps (Gmail, Slack, GitHub, etc.) via Composio's Tool Router.

- **Connection:** `COMPOSIO_API_KEY`
- **Access:** `import { getComposio } from "./lib/composio.js"`

### Daytona — Cloud Desktop Sandboxes & Computer Use

Dedicated isolated cloud sandbox per agent running desktop environments with X11, noVNC, and browser automation:

- **Lifecycle:** Automated sandbox provisioning (`createAgentSandbox`) on agent creation, auto-reconnect on paused state, and deletion on agent teardown.
- **Tools:** Computer use (`browser_navigate`, `take_screenshot`, `mouse_click`, `keyboard_type`) and live web interaction.
- **HITL Takeover:** `browser_wait_for_user` pauses execution and prompts user interaction in the live noVNC desktop preview.
- **Connection:** `DAYTONA_API_KEY` + `DAYTONA_SERVER_URL`

### Artifacts & Document Rendering Engine

Comprehensive artifact renderer mounted in `apps/web/modules/artifacts/`:

- **Interactive Previews:** HTML Sandboxes (`HtmlSandbox`), SVGs (`SvgSandbox`), and Mermaid diagrams (`MermaidSandbox`).
- **Rich Document Viewers:**
  - Multi-page PDF canvas renderer (`pdfjs-dist`) with word-wrapped synthesis (`pdf-lib`).
  - Microsoft Word document renderer (`docx-preview`, `docx`).
  - Native Spreadsheet viewer (`xlsx`) with sheet switching and formatted tables.
  - Formatted text & markdown viewer (`react-markdown` + `remark-gfm`) with automatic remote content fetching.
- **Client & Server Generation:** Multi-format file creation tool (`create_downloadable_file`) and client-side zero-roundtrip export (`jspdf`, `docx`).

### Trigger.dev — Background Tasks

Durable background execution in `apps/api`. Task definitions in `apps/api/src/trigger/`.

Handles long-running agent runs, scheduled tasks, retries, and human-in-the-loop workflows. Keeps background work separate from the HTTP request lifecycle.

- **Connection:** `TRIGGER_SECRET_KEY` + `TRIGGER_PROJECT_REF`
- **Config:** `apps/api/trigger.config.ts`
- **Dev:** `npx trigger.dev@latest dev` (from `apps/api/`)

### MCP — Model Context Protocol

`@modelcontextprotocol/sdk` installed in `packages/api-contract` for future tool protocol support. Enables the agent engine to connect to external MCP servers for standardized tool discovery and execution.

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | Server only (`packages/db`) | PostgreSQL connection string |
| `UPSTASH_REDIS_REST_URL` | Server only (`packages/db`) | Upstash Redis endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Server only (`packages/db`) | Upstash Redis auth token |
| `GEMINI_API_KEY` | Server only (`apps/api`) | Google Generative AI / Gemini API key |
| `DAYTONA_API_KEY` | Server only (`api-contract`) | Daytona cloud sandbox API key |
| `DAYTONA_SERVER_URL` | Server only (`api-contract`) | Daytona server API endpoint |
| `SUPABASE_STORAGE_BUCKET`| Server only (`apps/api`) | Storage bucket for generated files |
| `COMPOSIO_API_KEY` | Server only (`api-contract`) | Composio API key |
| `BETTER_AUTH_SECRET` | Server only (`api-contract`) | Auth encryption secret |
| `BETTER_AUTH_URL` | Server only (`api-contract`) | Auth base URL |
| `TRIGGER_SECRET_KEY` | Server only (`apps/api`) | Trigger.dev secret key |
| `TRIGGER_PROJECT_REF` | Server only (`apps/api`) | Trigger.dev project ref |
| `PORT` | Server only (`apps/api`) | API server port (default: 3001) |
| `NEXT_PUBLIC_API_URL` | Web app (`apps/web`) | API base URL for the client |

## Getting Started

```bash
bun install

# Copy and fill environment variables
cp .env.example .env

# Start the API server
cd apps/api && bun run dev

# Start the web app (separate terminal)
cd apps/web && bun run dev

# Verify
curl http://localhost:3001/api/health
curl http://localhost:3001/api/auth/ok
```
