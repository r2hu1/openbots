# OpenBots API (`apps/api`)

The core backend server and agent execution engine for OpenBots, powered by Bun and Hono.

## Overview

- **Agent Runtime & Execution**: Multi-model agent runner powered by Vercel AI SDK (`ToolLoopAgent` and `streamText`), supporting OpenAI, Anthropic, Google, and Daytona sandbox computer use.
- **Real-Time Streaming**: Server-Sent Events (SSE) broadcasting agent thought deltas, tool starts, and tool finishes to connected web clients.
- **Cloud Sandbox Orchestration**: Daytona cloud container lifecycle management with virtual display (X11) and noVNC on port 6080.
- **Background Jobs & Triggers**: Trigger.dev v4 task handlers for durable scheduled runs and cron jobs.
- **Authentication**: Better Auth server handlers with session verification.

## Tech Stack

- **Runtime**: Bun HTTP server
- **Framework**: Hono
- **AI SDK**: Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`)
- **Sandboxes**: `@daytona/sdk`
- **Integrations**: `@composio/core`, `@composio/vercel`, `@modelcontextprotocol/client`
- **Background Tasks**: Trigger.dev v4

## Scripts

```bash
# Start development server with hot-reload (port 3001)
bun run dev

# Build for production
bun run build

# Start production build
bun run start

# Run agent runtime tests
bun run test

# Trigger.dev local development
bun run trigger:dev

# Deploy Trigger.dev tasks
bun run trigger:deploy

# Code formatting & linting
bun run lint
bun run format

# Typecheck
bun run typecheck
```
