---
name: browserbase-sdk
description: "Browserbase cloud-headless-browser SDK expertise for TypeScript/Node. Use when code imports `@browserbasehq/sdk`, `@browserbasehq/stagehand`, `playwright-core`, or `puppeteer-core` and connects to Browserbase; when code POSTs to `api.browserbase.com/v1/sessions`, `/v1/contexts`, `/v1/extensions`, or `/v1/projects`; when sending the `x-bb-api-key` header or using `BROWSERBASE_API_KEY`/`BROWSERBASE_PROJECT_ID`; when the user asks about Browserbase sessions, contexts, proxies, downloads, uploads, recordings, live debugger URL, captcha solving, advanced stealth, verified browsers, fingerprinting, BYOS S3 storage, regions (`us-west-2`/`us-east-1`/`eu-central-1`/`ap-southeast-1`), keepAlive, the `connectUrl` CDP WebSocket, `chromium.connectOverCDP`, `puppeteer.connect({browserWSEndpoint})`, the `browser.contexts()[0]` default-context pattern, Stagehand `act`/`extract`/`observe`/`agent` primitives, the Model Gateway, or deploying serverless via Browserbase Functions."
---

# Browserbase SDK

Browserbase runs production headless Chromium in isolated VMs and exposes a CDP WebSocket per session. Code drives the browser with Playwright, Puppeteer, Selenium, or Stagehand (AI primitives on top of Playwright). The `@browserbasehq/sdk` package is a thin REST client for sessions, contexts, extensions, and projects — it does not drive the browser itself.

## Base URL & auth

```
POST https://api.browserbase.com/v1/sessions
x-bb-api-key: $BROWSERBASE_API_KEY
Content-Type: application/json
```

Env vars used by every official package:

- `BROWSERBASE_API_KEY` — from <https://browserbase.com/settings>
- `BROWSERBASE_PROJECT_ID` — required by Stagehand; inferred from key by `@browserbasehq/sdk`

Each browser runs in a dedicated VM destroyed after the session. SOC 2 Type II across plans, HIPAA on Scale.

## Three integration paths

| Path | Packages | Best for |
|------|----------|----------|
| Raw SDK | `@browserbasehq/sdk` | Manage sessions/contexts/extensions; no browser driving |
| SDK + Playwright/Puppeteer | `@browserbasehq/sdk` + `playwright-core` or `puppeteer-core` | Deterministic scripted automation |
| Stagehand | `@browserbasehq/stagehand` | AI-driven `act`/`extract`/`observe`/`agent` on top of Playwright |

The SDK is REST only. Browser control happens through `connectUrl` (Playwright/Puppeteer/CDP) or `seleniumRemoteUrl` (Selenium). Stagehand wraps the SDK + Playwright internally.

### Quickstart — Playwright (TypeScript)

```typescript
import { chromium } from 'playwright-core';
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });

const session = await bb.sessions.create({
  projectId: process.env.BROWSERBASE_PROJECT_ID!,
});

const browser = await chromium.connectOverCDP(session.connectUrl);
const defaultContext = browser.contexts()[0];
const page = defaultContext.pages()[0];

await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
await page.screenshot({ path: 'shot.png', fullPage: true });

await page.close();
await browser.close();
console.log(`Replay: https://browserbase.com/sessions/${session.id}`);
```

### Quickstart — Puppeteer (TypeScript)

```typescript
import puppeteer from 'puppeteer-core';
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });
const session = await bb.sessions.create({ projectId: process.env.BROWSERBASE_PROJECT_ID! });

const browser = await puppeteer.connect({ browserWSEndpoint: session.connectUrl });
const [page] = await browser.pages();
await page.goto('https://example.com');
await browser.disconnect();
```

### Quickstart — Stagehand (TypeScript)

```typescript
import { Stagehand } from '@browserbasehq/stagehand';
import { z } from 'zod';

const stagehand = new Stagehand({
  env: 'BROWSERBASE',
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
  model: 'google/gemini-3-flash-preview', // routed through Browserbase Model Gateway
});

await stagehand.init();
const page = stagehand.page;
await page.goto('https://news.ycombinator.com');

await page.act('click the first story link');
const data = await page.extract({
  instruction: 'extract the title and points',
  schema: z.object({ title: z.string(), points: z.number() }),
});

await stagehand.close();
```

### Quickstart — raw HTTP

```bash
curl -X POST https://api.browserbase.com/v1/sessions \
  -H "x-bb-api-key: $BROWSERBASE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"'"$BROWSERBASE_PROJECT_ID"'"}'
```

## Session — request shape

```typescript
type CreateSessionParams = {
  projectId: string;                  // optional with SDK; required via REST
  extensionId?: string;
  timeout?: number;                   // 60–21600 sec; defaults to project setting
  keepAlive?: boolean;                // Hobby+; survives disconnect
  region?: 'us-west-2' | 'us-east-1' | 'eu-central-1' | 'ap-southeast-1';
  proxies?: boolean | ProxyConfig[];
  userMetadata?: Record<string, string>; // ≤512 chars JSON, string values, no arrays
  browserSettings?: {
    context?: { id: string; persist?: boolean };
    viewport?: { width: number; height: number };
    blockAds?: boolean;               // default false
    solveCaptchas?: boolean;          // default true
    recordSession?: boolean;          // default true
    logSession?: boolean;             // default true
    advancedStealth?: boolean;        // Scale plan
    verified?: boolean;               // Scale plan, premium fingerprint
    captchaImageSelector?: string;
    captchaInputSelector?: string;
    os?: 'windows' | 'mac' | 'linux' | 'mobile' | 'tablet';
    ignoreCertificateErrors?: boolean; // default true
  };
};
```

## Session — response shape

```typescript
type Session = {
  id: string;
  createdAt: string; updatedAt: string;
  startedAt?: string; endedAt?: string; expiresAt?: string;
  projectId: string;
  status: 'PENDING' | 'RUNNING' | 'ERROR' | 'TIMED_OUT' | 'COMPLETED';
  region: string;
  contextId?: string;
  keepAlive: boolean;
  proxyBytes: number;
  userMetadata?: Record<string, string>;
  connectUrl: string;            // wss://… CDP endpoint
  seleniumRemoteUrl: string;     // https://… Selenium grid
  signingKey: string;
};
```

`connectUrl` is single-use per browser connection. Reconnecting the same `connectUrl` after disconnect requires `keepAlive: true`.

## Default-context gotcha

Browserbase pre-creates the browser context. Calling `browser.newContext()` in Playwright spawns a second context that ignores `browserSettings.context`/proxies. Use the existing one:

```typescript
const defaultContext = browser.contexts()[0];
const page = defaultContext.pages()[0]; // pre-created blank page
```

## Lifecycle

```typescript
// Release a session early
await bb.sessions.update(session.id, {
  projectId: process.env.BROWSERBASE_PROJECT_ID!,
  status: 'REQUEST_RELEASE',
});

// Live debugger URLs
const live = await bb.sessions.debug(session.id);
// { debuggerUrl, debuggerFullscreenUrl, wsUrl, pages: [{ id, url, debuggerUrl, ... }] }

// Filter sessions by metadata
const matches = await bb.sessions.list({ q: "user_metadata['env']:'staging'" });
```

## Feature map

| Feature | Trigger | Reference |
|---------|---------|-----------|
| Full session API: create/list/retrieve/update/debug, lifecycle, regions, keep-alive, metadata | `bb.sessions.*` | [references/sessions.md](references/sessions.md) |
| Playwright + Puppeteer connection patterns, default-context gotcha, screenshots, navigation | `connectOverCDP`, `puppeteer.connect` | [references/playwright-puppeteer.md](references/playwright-puppeteer.md) |
| Stagehand AI primitives: `act`/`extract`/`observe`/`agent`, ConstructorParams, Model Gateway, BYO LLM | `import { Stagehand }` | [references/stagehand.md](references/stagehand.md) |
| Persistent auth state via Contexts, `persist: true`, one-per-site rule | `bb.contexts.*`, `browserSettings.context` | [references/contexts.md](references/contexts.md) |
| Browserbase-managed/external/none proxies, geolocation, `domainPattern` rules | `proxies: true`, `proxies: [{type:...}]` | [references/proxies.md](references/proxies.md) |
| Advanced stealth, verified browsers, captcha solving (custom selectors), block-ads | `advancedStealth`, `verified`, `solveCaptchas` | [references/stealth-and-captcha.md](references/stealth-and-captcha.md) |
| Downloads (`Browser.setDownloadBehavior` to `"downloads"`), uploads (`setInputFiles`, large-file API), file chooser | `bb.sessions.downloads.*`, `bb.sessions.uploads.*` | [references/downloads-uploads.md](references/downloads-uploads.md) |
| Live view, recordings (rrweb), logs, debugger URLs, embedding | `bb.sessions.debug`, `sessions.recording`, `sessions.logs` | [references/observability.md](references/observability.md) |
| Custom extensions via uploaded zip | `bb.extensions.create`, `extensionId` | [references/extensions.md](references/extensions.md) |

## Always-fresh docs

Append `.md` to any docs page for clean Markdown:

- Introduction: <https://docs.browserbase.com/reference/introduction.md>
- Node SDK reference: <https://docs.browserbase.com/reference/sdk/nodejs.md>
- Create session API: <https://docs.browserbase.com/reference/api/create-a-session.md>
- Full aggregate: <https://docs.browserbase.com/llms-full.txt>
- Index: <https://docs.browserbase.com/llms.txt>
- SDK source: <https://github.com/browserbase/sdk-node>
- Stagehand source: <https://github.com/browserbase/stagehand>

## Common pitfalls

- **`browser.contexts()[0]` not `browser.newContext()`** — only the pre-created context honors `browserSettings.context`, proxies, and fingerprint.
- **`Browser.setDownloadBehavior` `downloadPath` is the literal string `"downloads"`** — absolute paths like `/tmp/downloads` break sync.
- **`solveCaptchas` defaults to `true`** — disable for compliance/audit runs.
- **`recordSession` and `logSession` default to `true`** — disable for privacy-sensitive flows; cannot be re-enabled mid-session.
- **`connectUrl` is one-shot per CDP connect** — reconnecting after disconnect requires `keepAlive: true`.
- **`userMetadata` JSON cap is 512 chars, string values only, no arrays** — query with `q: "user_metadata['env']:'staging'"`.
- **Stagehand requires `BROWSERBASE_PROJECT_ID`** even though the raw SDK can infer it from the API key.
- **Free-tier concurrency is 3 sessions; rate-limited at the create endpoint** even when under max concurrency.
- **`verified: true` and `advancedStealth` are Scale-plan only** — they 4xx on lower tiers.
- **`browserbase` proxies have a 1 MB minimum per session** then round to nearest MB; restricted-category sites (Apple, finance, streaming, ticketing, some Google) are blocked.
- **Sessions persist beyond script exit unless explicitly released** — `REQUEST_RELEASE` via `sessions.update` or let `timeout` expire; `keepAlive` prolongs further.
- **`os` and `verified` together require Scale tier** — `os: 'windows' | 'mac' | 'linux' | 'mobile' | 'tablet'`.
- **Selenium uses `seleniumRemoteUrl`, not `connectUrl`** — different protocol entirely.
