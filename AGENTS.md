<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# OpenBots Monorepo Guide for AI Agents

Welcome to OpenBots! This file is the primary orientation and master index for AI coding assistants working in this repository. Read this document before making code modifications so you do not need to repeatedly re-index or reconstruct architecture from scratch.

---

## 1. System Overview & Technology Stack

OpenBots is an open-source autonomous AI coworker platform with real-time web chat, durable background schedules (Trigger.dev), interactive artifacts, and isolated cloud desktop sandboxes with computer use (Daytona).

- **Package Manager**: `bun` (Bun workspaces)
- **Monorepo Orchestrator**: Turborepo (`turbo`)
- **Frontend (`apps/web`)**: Next.js 16 (App Router), React 19, Tailwind CSS v4, TanStack Query v5, Hono RPC client
- **Backend (`apps/api`)**: Bun HTTP server, Hono, Vercel AI SDK (`ToolLoopAgent` & `streamText`), Trigger.dev v4, Server-Sent Events (SSE)
- **Database & State (`packages/db`)**: PostgreSQL via Drizzle ORM, dual-mode Redis (ioredis / Upstash)
- **Sandboxes & Computer Use (`packages/api-contract/src/daytona`)**: Daytona Cloud SDK, noVNC on port 6080, X11 virtual display
- **Integrations**: Composio (200+ SaaS apps), Model Context Protocol (MCP)

---

## 2. Monorepo Map & Package Guides

Every major application and package maintains its own detailed architectural guide:

| Package | Path | Dedicated Guide | Description |
|---|---|---|---|
| **Web** | `apps/web` | [`apps/web/AGENTS.md`](apps/web/AGENTS.md) | Next.js 16 app, chat UI, timeline reconciliation, desktop live preview, artifact renderer |
| **API** | `apps/api` | [`apps/api/AGENTS.md`](apps/api/AGENTS.md) | Hono API server, AI SDK execution engine, SSE stream hub, Trigger.dev tasks |
| **API Contract** | `packages/api-contract` | [`packages/api-contract/AGENTS.md`](packages/api-contract/AGENTS.md) | Hono route definitions, Zod validation schemas, Daytona tools, built-in tool registry |
| **Database** | `packages/db` | [`packages/db/AGENTS.md`](packages/db/AGENTS.md) | Drizzle PostgreSQL schemas (agents, conversations, runs, steps, schedules), Redis, Supabase storage |
| **UI** | `packages/ui` | [`packages/ui/AGENTS.md`](packages/ui/AGENTS.md) | Tailwind v4 design system, Base UI primitives, Blobatars, toast, dialogs |
| **API Client** | `packages/api-client` | — | Typed Hono RPC client wrapper (`hc<AppType>`) consumed by `apps/web` |
| **TypeScript Config** | `packages/typescript-config` | — | Shared tsconfig base definitions |

---

## 3. Core Architectural Lifecycles & Critical Patterns

### A. Real-Time Chat & Run Streaming
1. User prompts are sent from `apps/web/modules/conversations/components/input-composer.tsx`.
2. `apps/web/modules/agents/hooks/use-agent-execution.ts` adds an optimistic user message and kicks off the run via `/api/runs`.
3. Client connects to `/api/runs/:id/stream` (SSE).
4. `apps/api/src/agent/execute.ts` executes the model via Vercel AI SDK `streamText` and broadcasts `delta`, `tool_start`, and `tool_finish` events over `runEventHub`.
5. `apps/web/modules/conversations/hooks/use-reconciled-messages.ts` blends server history with active stream deltas chronologically without duplicate keys.

### B. Daytona Cloud Desktop & Computer Use
1. Each agent is provisioned with a dedicated Daytona cloud sandbox (`createAgentSandbox`).
2. Sandboxes have `autoStopInterval: 0` and `autoPauseInterval: 0` configured to prevent auto-pausing after 15 minutes of inactivity.
3. `getAgentSandbox()` automatically checks if a sandbox is in `paused` or `stopped` state and calls `sandbox.start()` before running tools.
4. If a sandbox was deleted or returned 404, it self-heals by creating a new sandbox and persisting the ID to the database.
5. Desktop tools (`browser_navigate`, `take_screenshot`, `mouse_click`, `keyboard_type`) ensure noVNC on port 6080 is warmed up and attach signed preview URLs to tool outputs.
6. The frontend live preview sidebar opens immediately upon desktop tool invocation and remains open so the user can see what was done.
7. System prompt instructions strictly forbid boilerplate AI refusals ("browser environment is unavailable") and instruct the agent to leave the browser open rather than prematurely calling `browser_close`.

### C. Human-in-the-Loop (HITL)
1. When an agent invokes `browser_wait_for_user`, the run pauses and awaits user interaction via `waitForHumanInteractionResponse(contextKey)`.
2. The UI renders an input prompt banner in the desktop preview panel.
3. Once the user clicks "I'm Done" or "Skip", a POST is sent to `/api/daytona/hitl/respond`, resolving the promise and resuming the agent.

### D. Durable Background Workflows & Cron Schedules
1. Scheduled reminders and recurring tasks are created via `packages/api-contract/src/tools/schedule.ts`.
2. Tasks are dispatched to **Trigger.dev v4** (`apps/api/src/trigger/run-agent.ts`).
3. Scheduled executions survive server restarts and send Web Push notifications upon completion.

---

## 4. Development & Verification Workflows

- **Run Dev Server**: `bun run dev` (starts web on `:3000` and api on `:3001`)
- **Typecheck Whole Monorepo**: `bun run typecheck`
- **Lint & Format**: `bun run lint`
- **Database Schema Sync**:
  - `cd packages/db && bun run db:generate`
  - `cd packages/db && bun run db:push`
