# Sessions

`@browserbasehq/sdk` exposes session lifecycle as `bb.sessions.*`. Each method maps 1:1 to a REST endpoint under `https://api.browserbase.com/v1/sessions`.

## Table of contents

- [Create](#create)
- [List & filter](#list--filter)
- [Retrieve](#retrieve)
- [Update / release](#update--release)
- [Debug URLs](#debug-urls)
- [Logs](#logs)
- [Recording](#recording)
- [Regions](#regions)
- [Timeouts & keep-alive](#timeouts--keep-alive)
- [Concurrency & rate limits](#concurrency--rate-limits)

## Create

```typescript
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });

const session = await bb.sessions.create({
  projectId: process.env.BROWSERBASE_PROJECT_ID!,
  region: 'us-west-2',
  timeout: 3600,                    // 1 hour
  keepAlive: true,
  proxies: true,
  userMetadata: { env: 'staging', run: 'nightly-42' },
  browserSettings: {
    viewport: { width: 1920, height: 1080 },
    blockAds: true,
    solveCaptchas: true,
    recordSession: true,
    logSession: true,
    advancedStealth: true,
    os: 'mac',
  },
});
```

Returns the `Session` object with `connectUrl` (CDP wss://) and `seleniumRemoteUrl`.

## List & filter

```typescript
const all = await bb.sessions.list();
const running = await bb.sessions.list({ status: 'RUNNING' });
const tagged = await bb.sessions.list({
  q: "user_metadata['env']:'staging'",
});
```

The `q` syntax supports field equality only (`user_metadata['key']:'value'`). Arrays unsupported.

## Retrieve

```typescript
const s = await bb.sessions.retrieve(sessionId);
// status: PENDING | RUNNING | ERROR | TIMED_OUT | COMPLETED
```

## Update / release

```typescript
await bb.sessions.update(sessionId, {
  projectId: process.env.BROWSERBASE_PROJECT_ID!,
  status: 'REQUEST_RELEASE',
});
```

`status: 'REQUEST_RELEASE'` is the only end-the-session transition. Sessions otherwise end on `timeout` expiry, all clients disconnecting with `keepAlive: false`, or VM error.

## Debug URLs

```typescript
const dbg = await bb.sessions.debug(sessionId);
// {
//   debuggerUrl: 'https://...',          // chrome://inspect-style
//   debuggerFullscreenUrl: 'https://...', // embeddable live view
//   wsUrl: 'wss://...',                  // raw CDP
//   pages: [{ id, url, faviconUrl, title, debuggerUrl, debuggerFullscreenUrl }],
// }
```

`debuggerFullscreenUrl` embeds in an `<iframe sandbox="allow-same-origin allow-scripts">`.

## Logs

```typescript
const logs = await bb.sessions.logs(sessionId);
// Array of CDP events captured during the session.
```

`logSession: false` at create time disables capture.

## Recording

```typescript
const events = await bb.sessions.recording(sessionId);
// rrweb event stream; replay with rrweb-player
```

## Regions

| Value | Location |
|-------|----------|
| `us-west-2` | Oregon |
| `us-east-1` | Virginia |
| `eu-central-1` | Frankfurt |
| `ap-southeast-1` | Singapore |

Region is fixed at create time. Pick the one nearest the target site for lower TTFB; pick by data-residency for compliance.

## Timeouts & keep-alive

- `timeout`: 60–21600 seconds. Defaults to project's `defaultTimeout` (Settings → Project).
- `keepAlive: true` keeps the VM warm after CDP disconnect for `keepAliveTimeoutMs` (Hobby+). Reconnect by reusing `connectUrl` from the original session response.
- Idle sessions still bill per minute until released or timed out.

## Concurrency & rate limits

| Plan | Max concurrent | Create rate / min | Retention |
|------|----------------|-------------------|-----------|
| Free | 3 | 5 | 7 days |
| Developer | 25 | 25 | 7 days |
| Startup | 100 | 50 | 30 days |
| Scale | custom | 150+ | 30+ days |

Create-rate ceiling applies independently of concurrency — under-concurrency 4xx still possible during burst.
