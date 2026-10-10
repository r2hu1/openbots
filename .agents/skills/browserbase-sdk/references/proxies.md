# Proxies

Set `proxies: true` for Browserbase-managed residential proxies, or pass an array of `ProxyConfig` for fine control. Available on Developer plan and above. Usage billed per MB transferred (1 MB minimum per session, then nearest MB).

## Table of contents

- [Quick toggle](#quick-toggle)
- [Browserbase-managed with geolocation](#browserbase-managed-with-geolocation)
- [Custom external proxy](#custom-external-proxy)
- [Domain-pattern routing](#domain-pattern-routing)
- [Restricted categories](#restricted-categories)

## Quick toggle

```typescript
const session = await bb.sessions.create({
  projectId,
  proxies: true,        // best-effort US residential
});
```

## Browserbase-managed with geolocation

```typescript
proxies: [
  {
    type: 'browserbase',
    geolocation: {
      country: 'US',
      state: 'CA',          // US states only
      city: 'Los Angeles',
    },
  },
]
```

`country` ISO-3166 alpha-2. State is US-only. City names match the closest available POP — out-of-coverage cities fall back to nearest. 201 countries supported.

## Custom external proxy

```typescript
proxies: [
  {
    type: 'external',
    server: 'http://proxy.example.com:8080',  // http(s)://host:port
    username: 'user',                          // optional
    password: 'pass',                          // optional
  },
]
```

Browserbase verifies reachability at session-create time. Unreachable proxies fail the create call.

## Domain-pattern routing

Combine multiple rules — first match wins:

```typescript
proxies: [
  { type: 'browserbase', geolocation: { country: 'DE' }, domainPattern: '*.shop.example.com' },
  { type: 'external', server: 'http://corp-proxy:8080', domainPattern: '*.internal.example.com' },
  { type: 'none', domainPattern: '*.cdn.example.com' },     // bypass proxying for assets
  { type: 'browserbase' },                                  // catch-all default
]
```

`domainPattern` accepts glob-style wildcards (`*`). `type: 'none'` sends traffic direct without proxy.

## Restricted categories

Browserbase-managed proxies block certain target categories regardless of plan:

- Apple services (apple.com, icloud.com)
- Streaming and entertainment platforms
- Financial institutions
- Some Google domains
- Ticketing
- Select government domains

For these, route via `type: 'external'` with a customer-controlled exit, or contact Browserbase for allow-list review.
