# packages/db Architecture & Engineering Guide

## 1. Role & Purpose
`@openbots/db` is the persistence layer for OpenBots. It manages the **PostgreSQL** schema using **Drizzle ORM**, handles database connection pooling, executes schema migrations, and provides a dual-mode **Redis** client (supporting both self-hosted `ioredis` and serverless `@upstash/redis`). It also includes helper wrappers for Supabase Storage.

---

## 2. Directory Structure & Key Modules

```
packages/db/
├── src/
│   ├── index.ts                # Main export barrel (db instance, schema tables, redis, storage)
│   ├── client.ts               # Postgres connection pool via postgres.js + Drizzle client
│   ├── redis.ts                # Dual Redis client (ioredis fallback to Upstash Redis)
│   ├── storage.ts              # Supabase storage helpers (upload, getPublicUrl, delete)
│   │
│   └── schemas/                # Drizzle Database Schemas
│       ├── agents.ts           # agents table (id, name, instructions, model, avatar, sandboxId, allowedTools)
│       ├── conversations.ts    # conversations & messages tables (threads, metadata, reactions)
│       ├── runs.ts             # runs & run_steps tables (status, triggerType, input, output, tool execution logs)
│       ├── schedules.ts        # schedules table (cron, nextRunAt, isPaused, task payload)
│       ├── connections.ts      # user integrations & auth connections
│       └── auth.ts             # Better Auth tables (users, sessions, accounts, verifications)
│
├── drizzle/                    # Generated SQL migration files
├── drizzle.config.ts           # Drizzle Kit configuration
└── package.json
```

---

## 3. Core Architectural Concepts & Invariants

### A. Core Relational Models
1. **Agents (`agents`)**:
   - `id`: UUID primary key.
   - `sandboxId`: Dedicated Daytona sandbox container ID.
   - `model`: e.g. `google/gemini-2.5-flash`, `anthropic/claude-3-7-sonnet`.
   - `allowedTools`: Array of enabled tool names.
2. **Conversations & Messages (`conversations`, `messages`)**:
   - Messages store multimodal payloads in `content` (`{ text: string, images?: string[] }`).
   - `metadata` stores message-level reactions, citations, and step details.
3. **Runs & Steps (`runs`, `run_steps`)**:
   - `runs` tracks top-level executions (`queued`, `running`, `completed`, `failed`).
   - `run_steps` records granular execution events (`model`, `tool`, `tool_name`, `tool_input`, `tool_output`).
4. **Schedules (`schedules`)**:
   - Manages recurring cron expressions and one-off delayed tasks linked to Trigger.dev tasks.

### B. Redis Layer (`redis.ts`)
- Automatically picks up `REDIS_URL` for high-throughput local/VPS environments (via `ioredis`), or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` for serverless environments.
- Used for ephemeral live desktop session metadata (`desktop:session:${key}`), Daytona preview URL caching (`daytona:preview:${id}`), and HITL responses.

---

## 4. Key Rules for Agents Modifying `packages/db`
- **Schema Changes**: When updating schema definitions in `src/schemas/`, run `bun run db:generate` and `bun run db:push` to sync database tables.
- **Foreign Keys & Cascades**: Respect foreign key relations. Always specify `onDelete: "cascade"` where children (like messages or run steps) belong strictly to parent entities.
- **Type Export**: Export both `Select<Model>` and `Insert<Model>` inferred types for every schema.
