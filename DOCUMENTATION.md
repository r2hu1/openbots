# OpenBots Technical Documentation

Comprehensive architectural reference, infrastructure setup, Docker Compose configuration, database schemas, and developer workflows for OpenBots.

---

## 1. System Architecture

OpenBots is structured as a high-performance monorepo with distinct separation between client, contract, domain execution, and background workers.

```
                                  +------------------------------+
                                  |      Next.js Frontend        |
                                  |   (React 19 / App Router)    |
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
  |    Direct Agent Executor     |                                |   Trigger.dev v4 Worker      |
  |    (In-process fast path)    |                                |   (Durable background tasks) |
  +--------------+---------------+                                +--------------+---------------+
                 |                                                               |
                 +-------------------------------+-------------------------------+
                                                 |
                 +-------------------------------+-------------------------------+
                 |                               |                               |
                 v                               v                               v
  +------------------------------+ +---------------------------+ +-------------------------------+
  |        PostgreSQL DB         | |        Redis Server       | |       External Providers        |
  | (Agents, Runs, Steps, Auth)  | | (Pub/Sub & Event Caching) | | (Google AI, Composio, MCP)    |
  +------------------------------+ +---------------------------+ +-------------------------------+
```

### Execution Pathways
1. **Synchronous Fast Path**: Immediate user requests handled by the Hono API server in `apps/api` using the Vercel AI SDK `ToolLoopAgent`. Runs are streamed to the client with sub-second feedback.
2. **Durable Asynchronous Path**: Long-running, delayed, or scheduled workflows routed via Trigger.dev v4 (`apps/api/src/trigger`). Tasks survive server restarts, support retries with exponential backoff, and can execute recurring cron schedules.

---

## 2. Monorepo Structure & Package Boundaries

Managed with **Bun Workspaces** and **Turborepo**:

```
openbots/
├── apps/
│   ├── web/                    # Next.js 16 (App Router, React 19, Tailwind CSS v4)
│   └── api/                    # Bun HTTP server (Hono) & Trigger.dev background worker
│
├── packages/
│   ├── api-contract/           # Shared Hono route schemas, Zod definitions & types
│   ├── api-client/             # End-to-end typed RPC client used by frontend
│   ├── db/                     # Drizzle ORM schemas, PostgreSQL client, dual Redis adapter
│   ├── ui/                     # UI component system and iconography
│   └── typescript-config/      # Shared TypeScript base configs
│
├── docker-compose.yml          # Container orchestration (Web, API, Redis, Trigger.dev v4)
├── .env.example                # Canonical environment variable reference
└── DOCUMENTATION.md            # Technical specifications (this document)
```

### Package Roles & Dependencies
- **`@openbots/api-contract`**: Defines the single source of truth for endpoints, query params, request bodies, and error responses.
- **`@openbots/api-client`**: Consumes `@openbots/api-contract` using Hono's RPC client (`hc<AppType>`), ensuring 100% type safety on the client without manual code generation.
- **`@openbots/db`**: Handles persistence via Drizzle ORM. Implements a dual-driver Redis client supporting both standard `REDIS_URL` (via `ioredis` for self-hosted Redis) and Upstash REST (`@upstash/redis` for serverless deployments).

---

## 3. Technology Stack & Installed Versions

| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Package Manager / Runtime** | Bun | `>= 1.4` (lockfile v2) | Monorepo dependency management and API runtime |
| **Frontend Framework** | Next.js (App Router) | `16.3.6` | Web application interface |
| **UI Library** | React | `19.2.8` | Client rendering engine |
| **Styling** | Tailwind CSS | `v4` | Design system styling |
| **API Framework** | Hono | `^4.7.11` | Lightweight, high-throughput HTTP server |
| **Agent Reasoning** | Vercel AI SDK (`ai`) | `^7.0.0` | Multi-step agent loop (`ToolLoopAgent`) |
| **LLM Provider** | Google Gemini (`@ai-sdk/google`)| `^4.0.0` | Multi-modal reasoning & vision |
| **Background Engine** | Trigger.dev v4 | `4.7.2` / `4.7.3` | Durable execution & cron scheduling |
| **Database ORM** | Drizzle ORM | `^0.45.3` | Type-safe PostgreSQL mapping & migrations |
| **Cache / Queue** | Redis (`ioredis` / Upstash) | `^6.0.0` | Ephemeral run state & agent event pub/sub |
| **Authentication** | Better Auth | `^1.7.7` | Session cookies, email/password, RBAC |
| **SaaS Tooling** | Composio Platform | `^0.22.0` | 200+ managed OAuth integrations |

---

## 4. Self-Hosting with Docker Compose

OpenBots includes production-ready Docker containers and an orchestration configuration in [docker-compose.yml](file:///Users/r2hu1/Projects/openbots/docker-compose.yml).

### Services Orchestrated
1. **`redis`**: Alpine Redis 7 image with health checks and persistent volume storage (`redis_data`).
2. **`api`**: Multi-stage Bun 1.4 image (`apps/api/Dockerfile`) running on port `3001`.
3. **`web`**: Multi-stage Node 20 / Bun builder image (`apps/web/Dockerfile`) serving Next.js on port `3000`.
4. **`trigger-postgres`**: Dedicated PostgreSQL 16 instance with logical replication for Trigger.dev internal state.
5. **`trigger-webapp`**: Official Trigger.dev v4.7.2 platform engine (`ghcr.io/triggerdotdev/trigger.dev:v4.7.2`) exposing the dashboard on port `3040`.
6. **`trigger-supervisor`**: Unified Trigger.dev v4 worker supervisor (`ghcr.io/triggerdotdev/supervisor:v4.7.2`) managing isolated container runs via the Docker socket.

### Deployment Commands

```bash
# 1. Prepare environment
cp .env.example .env
# Edit .env with your PostgreSQL database, Supabase storage keys, and Gemini API key

# 2. Push database migrations
bun run --filter @openbots/db db:push

# 3. Start core application services
docker-compose up -d redis api web

# 4. (Optional) Start full stack with self-hosted Trigger.dev v4.7.2
docker-compose up -d

# 5. Stop services
docker-compose down
```

---

## 5. Database Schema & Persistence

Database models are declared in `packages/db/src/schemas/`:

### Core Entities
- **`agents`**: Agent configurations, system instructions, temperature, model selection, and tool access flags.
- **`runs`**: Execution sessions belonging to an agent. Supports atomic run claiming:
  ```sql
  UPDATE runs SET status = 'running' WHERE id = $1 AND status = 'queued';
  ```
- **`run_steps`**: Granular trace entries recording model thoughts, tool calls, arguments, outputs, and timestamps.
- **`schedules`**: Scheduled tasks with cron strings, target run timestamps, and repeat configurations.
- **`users`, `sessions`, `accounts`, `verifications`**: Better Auth tables managing authentication, tokens, and multi-tenant access control.

### Migrations
```bash
# Generate SQL migration files
cd packages/db && bun run db:generate

# Apply migrations
bun run db:migrate

# Push schema directly to database (development / quick deploy)
bun run db:push

# Visual schema explorer
bun run db:studio
```

---

## 6. Built-in Tool Registry

Agents resolve tool requests through dynamic handlers in `packages/api-contract`:

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

---

## 7. Development & Monorepo Tooling

| Task | Command | Description |
| :--- | :--- | :--- |
| **Dev Mode** | `bun run dev` | Runs all applications in watch mode with Turbo |
| **Build** | `bun run build` | Compiles packages and creates production builds |
| **Type Check** | `bun run typecheck` | Validates TypeScript across all 7 workspace packages |
| **Lint** | `bun run lint` | Runs Biome code diagnostics |
| **Format** | `bun run format` | Enforces repository-wide Biome formatting rules |
| **Check** | `bun run check` | Combines linting and formatting verification |

---

## 8. Security & Production Hardening

- **Atomic Run Locks**: Prevents split-brain execution across multiple worker nodes using SQL transaction locks.
- **Trace Masking**: Sanitizes API tokens, database URIs, and authentication headers prior to writing steps to storage.
- **Non-Root Containers**: `apps/web` and `apps/api` containers execute under dedicated unprivileged users (`nextjs:nodejs` and `bun:bun`).
- **Secret Separation**: No secrets or runtime tokens are baked into container images; all configuration is supplied at runtime via environment variables.
