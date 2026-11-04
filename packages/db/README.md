# `@openbots/db`

Database schema, migrations, connection management, and storage adapters for OpenBots.

## Overview

- **Relational Storage**: PostgreSQL schema definitions using Drizzle ORM (agents, conversations, runs, steps, schedules, users).
- **Key-Value & Cache**: Dual-mode Redis client supporting both standard Redis (`ioredis`) and serverless Upstash Redis (`@upstash/redis`).
- **Object Storage**: Supabase Storage client integration for file and artifact persistence.

## Database Migrations & Commands

```bash
# Generate migrations based on schema changes
bun run db:generate

# Push schema directly to database (development)
bun run db:push

# Apply migrations
bun run db:migrate

# Launch Drizzle Studio web GUI
bun run db:studio
```

## Scripts

```bash
# Code formatting & linting
bun run lint
bun run format

# Typecheck
bun run typecheck
```
