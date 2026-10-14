# packages/api-contract Architecture & Engineering Guide

## 1. Role & Purpose
`@openbots/api-contract` is the single source of truth for all API definitions, request/response validation schemas, endpoint typings, and the core tool catalog across OpenBots. It is consumed by `apps/api` (to implement routes) and `packages/api-client` (to type RPC clients).

---

## 2. Directory Structure & Key Modules

```
packages/api-contract/
├── src/
│   ├── index.ts                # Main export barrel for all route definitions, types, and schemas
│   │
│   ├── routes/                 # Hono RPC route declarations with @hono/zod-validator
│   │   ├── agents.ts           # Agent routes schema (GET, POST, PATCH, DELETE)
│   │   ├── conversations.ts    # Threads, messages, pagination, reactions schemas
│   │   ├── runs.ts             # Run submission, cancellation, step logs schemas
│   │   ├── schedules.ts        # Recurring cron and delayed task schemas
│   │   ├── daytona.ts          # Sandbox inspection and HITL schemas
│   │   ├── connections.ts      # SaaS integration connection schemas
│   │   └── upload.ts           # File upload schemas
│   │
│   ├── daytona/                # Daytona Cloud Sandbox & Computer Use Integration
│   │   ├── client.ts           # Daytona SDK singleton initialization
│   │   ├── sandbox.ts          # Sandbox lifecycle (create, get, resume, auto-stop disable, preview URLs)
│   │   ├── tools.ts            # Complete Daytona tool suite (bash, read/write file, browser_navigate, take_screenshot, mouse/keyboard)
│   │   └── hitl.ts             # Redis-backed Human-in-the-Loop synchronization
│   │
│   ├── tools/                  # Built-in Agent Tools Registry
│   │   ├── web-search.ts       # DuckDuckGo live web search
│   │   ├── web-fetch.ts        # Web page content extractor
│   │   ├── schedule.ts         # Agent scheduling & timer tools
│   │   ├── calculations.ts     # Calculator & unit converter
│   │   ├── utilities.ts        # Time, UUID, JSON parser, text analyzers
│   │   └── registry.ts         # Master tool registry and category definitions
│   │
│   └── types/                  # Shared domain types, DTOs, and RPC payload definitions
│
└── package.json
```

---

## 3. Core Architectural Concepts & Invariants

### A. End-to-End Type Safety via Hono RPC
- Route declarations use Hono's chaining syntax with `zValidator`:
  ```typescript
  export const agentRoutes = new Hono()
    .get("/:id", zValidator("param", agentIdParamSchema), ...)
    .post("/", zValidator("json", createAgentSchema), ...);
  ```
- The combined `AppType` exported from `src/index.ts` allows `@openbots/api-client` to infer full endpoint typings without code generation.

### B. Daytona Sandbox Tool Suite (`src/daytona/tools.ts`)
- **Isolation**: Every agent interacts with an isolated Linux sandbox environment.
- **Tools**:
  - `bash`: Runs shell commands with standard exit code, stdout, and stderr.
  - `read_file` / `write_file` / `list_files`: Directly operates on sandbox filesystem.
  - `browser_navigate`: Opens desktop browser at specified URL, ensuring live desktop preview port 6080 is active.
  - `take_screenshot`: Captures desktop display, uploads to storage, and returns an embeddable markdown URL.
  - `browser_wait_for_user`: Pauses run and enters HITL mode when human intervention is required.
  - `mouse_click`, `keyboard_type`, `mouse_scroll`: Coordinates computer use actions.

---

## 4. Key Rules for Agents Modifying `packages/api-contract`
- **Zero Runtime Breakage**: Modifying request/response schemas directly affects both `apps/api` and `apps/web`. Ensure backwards compatibility.
- **Zod Validation**: Always use Zod schemas with descriptive error messages and defaults where sensible.
- **Export Discipline**: Always export newly created routes, schemas, and types in `src/index.ts`.
