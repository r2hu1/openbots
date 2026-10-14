# apps/web Architecture & Engineering Guide

## 1. Role & Purpose
`apps/web` is the user-facing web application for OpenBots built with **Next.js 16 (App Router)**, **React 19**, and **Tailwind CSS v4**. It provides the collaborative AI agent workspace, conversational chat interface, interactive live desktop/browser preview (Daytona noVNC), artifact side-sheet renderer, background schedules manager, integration connections, and run histories.

---

## 2. Directory Structure & Key Modules

```
apps/web/
├── app/                              # Next.js App Router (Routes & Layouts)
│   ├── layout.tsx                    # Root layout (ThemeProvider, QueryClientProvider, Web Push)
│   ├── page.tsx                      # Root redirect / landing
│   ├── (auth)/                       # Authentication views (sign-in, sign-up via Better Auth)
│   └── (dashboard)/                  # Main application dashboard
│       ├── layout.tsx                # Dashboard shell with agent sidebar & settings
│       ├── page.tsx                  # Workspace view (loads AgentWorkspace)
│       ├── settings/                 # Global provider keys & environment preferences
│       └── error.tsx / not-found.tsx # Next.js error boundaries
│
├── modules/                          # Domain-Driven Feature Modules
│   ├── agents/                       # Agent state, creation, header, execution hook
│   │   ├── components/               # AgentWorkspace, AgentHeader, CreateAgentDialog, ConfigureAgentSheet
│   │   ├── hooks/                    # useAgentExecution (runs, optimistic msgs, execution errors)
│   │   └── queries.ts                # TanStack query hooks for agent records
│   │
│   ├── conversations/                # Chat, messages, composer, real-time sync
│   │   ├── components/               # ConversationTimeline, ConversationMessageItem, InputComposer, ConversationLiveStatus
│   │   ├── hooks/                    # useReconciledMessages (merges server + optimistic + stream)
│   │   ├── queries.ts                # Infinite conversation queries, message mutations
│   │   └── utils.ts                  # Message text extraction, time formatting, artifact segmenting
│   │
│   ├── desktop/                      # Live Daytona Desktop & Computer Use preview
│   │   └── desktop-live-preview.tsx  # noVNC iframe viewer, fullscreen toggle, HITL prompts, auto-reconnect
│   │
│   ├── artifacts/                    # Interactive UI prototypes & Sandboxes
│   │   ├── artifact-card.tsx         # Inline collapsible artifact preview card
│   │   ├── artifact-sheet.tsx        # Slide-over full artifact viewer with code/preview tabs
│   │   ├── parser.ts                 # Parses `<openbots-artifact>` XML tags from LLM stream
│   │   └── sandboxes.tsx             # Sandboxed iframe environment for HTML/CSS/JS execution
│   │
│   ├── runs/                         # Execution steps, run status & history
│   │   ├── components/               # RunHistorySheet, ExecutionStepsCard, RunStatusBadge
│   │   ├── hooks/                    # useRunStream (SSE client for live step updates)
│   │   ├── activity-stream.ts        # Maps raw tool steps to friendly human-readable summaries
│   │   └── tool-label.ts             # Formats tool name, status, and input preview
│   │
│   ├── schedules/                    # Background workflows, timers, and cron jobs
│   │   ├── components/               # SchedulesSheet (create/edit/delete/pause schedules)
│   │   └── queries.ts                # Schedule query and mutation hooks
│   │
│   └── connections/                  # External SaaS integrations (Composio & MCP)
│       ├── components/               # ConnectionsSheet, IntegrationRow
│       └── queries.ts                # Connection statuses and OAuth initiation
│
├── components/                       # Shared application-level UI components
│   ├── shared/                       # Markdown renderer, code syntax highlighter, image uploaders
│   └── push/                         # Service worker registration & Web Push subscription manager
└── lib/                              # Shared frontend utilities (cn, auth client)
```

---

## 3. Core Architectural Concepts & Invariants

### A. Realtime Agent Execution (`useAgentExecution` + `useRunStream`)
1. When a user submits a prompt, `useAgentExecution`:
   - Adds an **optimistic message** immediately.
   - Triggers the run mutation via the API client.
   - Establishes a persistent **Server-Sent Events (SSE)** connection to `/api/runs/:runId/stream` via `useRunStream`.
2. As the server streams:
   - `delta` events append text chunks in real-time.
   - `tool_start` and `tool_finish` events update active run steps live.
   - `status` and `done` events finalize the run and invalidate TanStack cache queries.
3. **Reconciliation (`useReconciledMessages`)**:
   - Ensures strictly chronological order.
   - Deduplicates optimistic IDs against persistent database IDs to prevent duplicate chat bubbles or flickering.

### B. Live Desktop Preview (`DesktopLivePreview`)
1. Connected to Daytona sandboxes via signed noVNC URLs (`/vnc.html?autoconnect=true&resize=scale&reconnect=true&reconnect_delay=1000`).
2. When the agent invokes desktop tools (`browser_navigate`, `take_screenshot`, `mouse_click`), the preview sidebar in `AgentWorkspace` automatically opens so the user can observe the agent's screen in real time.
3. The sidebar persists after the run completes so the user can inspect the live page until manually dismissed.
4. **Human-In-The-Loop (HITL)**:
   - When the agent triggers `browser_wait_for_user`, an action banner renders above the desktop view.
   - The user completes required interaction (e.g. 2FA, Captcha) and clicks "I'm Done" or "Skip", posting to `/api/daytona/hitl/respond`.

### C. Artifact Engine (`modules/artifacts`)
1. The backend LLM generates artifacts formatted as:
   ```html
   <openbots-artifact id="..." type="text/html" title="...">
   ...code...
   </openbots-artifact>
   ```
2. `parser.ts` extracts artifacts from streaming and stored messages.
3. Mini UIs (charts, SVG icons, small widgets) render inline via `ArtifactCard`. Large UIs or prototypes open in the dedicated `ArtifactSheet` with live preview and source code tabs.

---

## 4. Key Rules for Agents Modifying `apps/web`
- **Next.js 16 & React 19 conventions**: Always use `"use client"` where hooks or browser APIs are used. Respect React 19 actions and hooks.
- **Styling**: OpenBots uses Tailwind CSS v4. Use existing design tokens (`bg-background`, `text-foreground`, `border-border/60`, `bg-muted/30`).
- **Icons**: Icons are sourced from `reicon-react` and `@tabler/icons-react`.
- **UI Primitives**: Import shared UI components from `@openbots/ui/components/*` instead of reinventing them locally.
- **Never Break SSE Stream Synchronization**: Keep `useReconciledMessages` and `useRunStream` state models aligned when adjusting message or run data shapes.
