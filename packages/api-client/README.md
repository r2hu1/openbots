# `@openbots/api-client`

Typed Hono RPC client library for interacting with the OpenBots API server across applications.

## Overview

Wraps Hono's `hc<AppType>` client with type definitions inferred directly from `@openbots/api-contract`. Provides end-to-end typed route parameters, request payloads, and response structures for the frontend without manual type duplication.

## Usage

```typescript
import { apiClient } from "@openbots/api-client";

// Call API routes with full type safety
const response = await apiClient.api.agents.$get();
```

## Scripts

```bash
# Code formatting & linting
bun run lint
bun run format

# Typecheck
bun run typecheck
```
