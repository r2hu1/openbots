# apps/api Architecture & Engineering Guide

## 1. Role & Purpose
`apps/api` is the backend service for OpenBots executed with **Bun**. It hosts the HTTP REST and Server-Sent Events (SSE) API using **Hono**, orchestrates agent runs via the Vercel AI SDK (`ToolLoopAgent`), coordinates Daytona Cloud Sandboxes for desktop automation, and executes durable background tasks/schedules via **Trigger.dev v4**.

---

## 2. Directory Structure & Key Modules

```
apps/api/
├── src/
│   ├── index.ts                # Bun server entrypoint (port 3001), routes registration, CORS & auth middleware
│   ├── agent/                  # Agent Core Runtime & Execution Engine
│   │   ├── execute.ts          # Main agent execution loop: system prompt builder, AI SDK streamText, SSE hub, step persistence
│   │   ├── tools.ts            # Tool aggregator (merges Daytona sandbox tools, web tools, composio, user tools)
│   │   ├── sse.ts              # In-memory / Redis-backed RunEventHub for streaming deltas and tool events
│   │   └── hitl.ts             # Human-in-the-Loop synchronization primitives
│   │
│   ├── routes/                 # Hono API Endpoint Handlers
│   │   ├── agents.ts           # Agent CRUD, instructions, avatar, allowed tools configuration
│   │   ├── conversations.ts    # Conversation threads, message retrieval, message reactions
│   │   ├── runs.ts             # Run submission, run cancellation, SSE stream endpoint (/api/runs/:id/stream)
│   │   ├── schedules.ts        # Background cron and delayed timer endpoints
│   │   ├── daytona.ts          # Daytona sandbox session status, preview URL resolution, HITL responses
│   │   ├── connections.ts      # Composio & MCP integrations, app connection state
│   │   └── upload.ts           # Multimodal conversation image uploads to Supabase storage
│   │
│   └── trigger/                # Trigger.dev v4 Background Workers
│       ├── run-agent.ts        # Durable scheduled task worker (re-instantiates executeAgent on schedule trigger)
│       └── web-push.ts         # Web Push notifications dispatcher on task completion
│
├── trigger.config.ts           # Trigger.dev project configuration & build settings
└── package.json
```

---

## 3. Core Architectural Concepts & Invariants

### A. Dual Execution Model
1. **Interactive Path (`executeAgent` in `src/agent/execute.ts`)**:
   - Handles real-time chat messages directly in-process for low latency (<100ms time to first token).
   - Uses Vercel AI SDK `streamText` with multi-step tool execution.
   - Emits SSE events (`delta`, `tool_start`, `tool_finish`, `status`, `done`) via `runEventHub`.
   - Persists execution steps in batches to the `run_steps` database table.
2. **Durable Scheduled Path (`src/trigger/run-agent.ts`)**:
   - Used for scheduled background alarms, delayed execution, and recurring cron jobs.
   - Operates through Trigger.dev v4. If the server restarts during execution, Trigger.dev automatically retries and preserves state.
   - Sends desktop & mobile Web Push notifications upon task completion.

### B. Self-Healing Daytona Cloud Sandboxes
1. Each agent is provisioned with a dedicated Daytona cloud sandbox (`packages/api-contract/src/daytona/sandbox.ts`).
2. If a sandbox expires or is suspended:
   - `getAgentSandbox()` detects `paused`/`stopped` state and automatically invokes `sandbox.start()`.
   - If not found (404), `createAgentSandbox()` auto-provisions a fresh sandbox, configures `autoStopInterval: 0`, and persists the new ID to the database (`agents.sandboxId`).
3. Screen tools (`browser_navigate`, `take_screenshot`, `mouse_click`) automatically warm up VNC port 6080 and publish the signed preview URL.

### C. System Prompt & Agent Boundaries (`src/agent/execute.ts`)
1. Injects current user environment, local time, timezone, and location.
2. Enforces computer use rules:
   - Strictly forbids boilerplate AI refusals ("my browser environment is unavailable").
   - Mandates using `browser_navigate` and `take_screenshot` directly.
   - Keeps the live desktop session open for user inspection rather than eagerly killing it with `browser_close`.

---

## 4. Key Rules for Agents Modifying `apps/api`
- **Use Hono & API-Contract**: All route signatures and parameters MUST match the type definitions in `@openbots/api-contract`.
- **Database Access**: Always use Drizzle ORM from `@openbots/db` with prepared queries or indexed columns (`runId`, `agentId`, `conversationId`).
- **Run Event Hub**: Any new execution events must be typed and published via `runEventHub.publish(runId, event)`.
- **Environment Keys**: Never expose raw secrets in run logs or tool outputs.
