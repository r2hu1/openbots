# Contexts

A Context is a server-side bundle of cookies, localStorage, IndexedDB, service-worker caches, form-fill data, and browser preferences. Reusing a Context across sessions skips re-login and preserves authenticated state. HTTP image/asset caches are not preserved.

## Table of contents

- [Create](#create)
- [Use in a session](#use-in-a-session)
- [Persist vs read-only](#persist-vs-read-only)
- [Update / list / delete](#update--list--delete)
- [Best practices](#best-practices)
- [Lifespan & invalidation](#lifespan--invalidation)

## Create

```typescript
const ctx = await bb.contexts.create({
  projectId: process.env.BROWSERBASE_PROJECT_ID!,
});
console.log(ctx.id); // store this
```

A new Context starts empty. State accumulates only when a session uses it with `persist: true`.

## Use in a session

```typescript
const session = await bb.sessions.create({
  projectId: process.env.BROWSERBASE_PROJECT_ID!,
  browserSettings: {
    context: { id: ctx.id, persist: true },
  },
});
```

When the session ends, all cookie/storage changes flush back to the Context. Subsequent sessions referencing the same `ctx.id` boot already-logged-in.

## Persist vs read-only

| `persist` | Effect |
|-----------|--------|
| `true` | Session changes overwrite Context state on close |
| `false` (default) | Context loaded read-only; changes discarded |

Use `persist: true` once during the login flow, then `persist: false` for parallel automation runs sharing the credentials.

## Update / list / delete

```typescript
await bb.contexts.list({ projectId });
await bb.contexts.retrieve(ctx.id);
await bb.contexts.update(ctx.id, { /* metadata fields */ });
await bb.contexts.delete(ctx.id);
```

## Best practices

- **One Context per site/login.** Cookies and storage from many sites in one Context bloat boot time and risk cross-site logout via overlapping cookie names.
- **Wait a few seconds between sequential sessions** sharing a Context — flush is async.
- **Avoid concurrent `persist: true` sessions** on the same Context — last-writer-wins flush corrupts state and many sites force re-auth on simultaneous identical sessions.
- **Pin geolocation.** Most session-detection systems recheck IP geo per request. Combine Context with a fixed proxy `geolocation`.
- **Verified browser on Scale** + Context + matching proxy is the highest-success combination for sticky logins.

## Lifespan & invalidation

Contexts persist indefinitely until explicitly deleted, the project is deleted, or the account is closed. Application-level invalidation still applies — server-side logout, password change, or expired session token requires re-authentication regardless of Context state.
