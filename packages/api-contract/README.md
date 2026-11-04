# `@openbots/api-contract`

Shared API contract, route definitions, schemas, and core agent tool registry for OpenBots.

## Overview

- **Route Contracts & Validation**: Hono route definitions paired with Zod validation schemas shared between `apps/api` and `packages/api-client`.
- **Built-in Tool Registry**: AI SDK tool definitions covering search, file parsing (PDF, DOCX, XLSX), scheduled triggers, web push, and human-in-the-loop interactions.
- **Daytona Tools**: Cloud desktop automation tools (browser navigation, screenshot capture, mouse clicks, keyboard entry) communicating with Daytona sandboxes.

## Dependencies

- Hono (`hono`, `@hono/zod-validator`)
- AI SDK (`ai`)
- Daytona SDK (`@daytona/sdk`)
- Database types & schemas from `@openbots/db`

## Scripts

```bash
# Code formatting & linting
bun run lint
bun run format

# Typecheck
bun run typecheck
```
