# OpenBots Web (`apps/web`)

The primary frontend web application for OpenBots, built with Next.js 16 (App Router), React 19, and Tailwind CSS v4.

## Overview

- **Real-Time Chat Interface**: Conversational UI supporting multi-turn agent runs, live tool step visualizations, and SSE streaming reconciliation.
- **Desktop Live Preview**: Embedded noVNC cloud sandbox desktop viewer with Human-In-The-Loop (HITL) prompt banners.
- **Interactive Artifacts**: Rich rendering support for code artifacts, documents, markdown, spreadsheets, and previews.
- **Authentication**: Client-side authentication flows integrated with Better Auth.

## Tech Stack

- **Framework**: Next.js 16 (Turbopack, App Router)
- **UI & Styling**: React 19, Tailwind CSS v4, `@openbots/ui`, Base UI primitives, Lucide icons, Tabler icons
- **State & Data Fetching**: TanStack Query v5, `@openbots/api-client` (typed Hono RPC)
- **Auth Client**: Better Auth client

## Scripts

```bash
# Run local development server (port 3000)
bun run dev

# Build for production
bun run build

# Start production server
bun run start

# Code formatting & linting
bun run lint
bun run format

# Typecheck
bun run typecheck
```
