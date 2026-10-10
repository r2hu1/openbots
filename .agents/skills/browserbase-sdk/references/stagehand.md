# Stagehand

Stagehand (`@browserbasehq/stagehand`) is the Browserbase-maintained AI-driven browser SDK. It wraps Playwright (`stagehand.page`, `stagehand.context` are real Playwright objects) and adds four LLM-backed primitives: `act`, `extract`, `observe`, `agent`.

## Table of contents

- [Install](#install)
- [Constructor params](#constructor-params)
- [act / extract / observe / agent](#act--extract--observe--agent)
- [Model Gateway vs BYO key](#model-gateway-vs-byo-key)
- [Local vs Browserbase env](#local-vs-browserbase-env)
- [Caching & determinism](#caching--determinism)

## Install

```bash
npm install @browserbasehq/stagehand zod
npm pkg set type=module
```

Set:

```bash
BROWSERBASE_API_KEY=...
BROWSERBASE_PROJECT_ID=...
```

## Constructor params

```typescript
import { Stagehand } from '@browserbasehq/stagehand';

const stagehand = new Stagehand({
  env: 'BROWSERBASE',                 // 'BROWSERBASE' | 'LOCAL'
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,

  model: 'google/gemini-3-flash-preview', // any model the Gateway routes
  modelClientOptions: { apiKey: process.env.OPENROUTER_API_KEY }, // BYO key path

  browserbaseSessionCreateParams: {
    region: 'us-west-2',
    browserSettings: { advancedStealth: true, blockAds: true, viewport: { width: 1280, height: 800 } },
    proxies: true,
  },

  localBrowserLaunchOptions: { headless: false }, // env: 'LOCAL' only
  domSettleTimeoutMs: 30_000,
  enableCaching: true,
  verbose: 1,                            // 0 = silent, 1 = info, 2 = debug
  logger: (line) => console.log(line),
});

await stagehand.init();
const page = stagehand.page;             // Playwright Page
const context = stagehand.context;       // Playwright BrowserContext
await stagehand.close();
```

## act / extract / observe / agent

```typescript
import { z } from 'zod';

await page.goto('https://news.ycombinator.com');

// observe → returns candidate actions (no side effects)
const candidates = await page.observe('find the search input');
// [{ description, method, arguments, selector }]

// act → execute one natural-language action
await page.act('click the comments link of the top story');
await page.act({ action: 'type %text% in search', variables: { text: 'AI' } });

// extract → structured data with zod schema
const data = await page.extract({
  instruction: 'extract the top 5 stories with title and points',
  schema: z.object({
    stories: z.array(z.object({ title: z.string(), points: z.number() })),
  }),
});

// agent → multi-step autonomous loop
const agent = stagehand.agent({
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  instructions: 'You are a careful research agent.',
});
await agent.execute('Find the top story about AI and summarize the comments.');
```

`page.act` and `page.observe` operate via DOM accessibility snapshots — atomic, auditable, low-hallucination. `agent.execute` chains them autonomously with reflection.

## Model Gateway vs BYO key

- **Gateway (default)**: requests routed through Browserbase. No third-party API key needed; usage billed via Browserbase. Pass any supported `model` slug (OpenAI, Anthropic, Google, etc.).
- **BYO**: pass `modelClientOptions: { apiKey, baseURL? }` to call the provider directly. Useful for enterprise model contracts or self-hosted endpoints.

## Local vs Browserbase env

```typescript
new Stagehand({ env: 'LOCAL', localBrowserLaunchOptions: { headless: false } });
```

`LOCAL` boots a local Chromium for development. No `apiKey`/`projectId` required. Identical primitive surface so code ports between modes unchanged.

## Caching & determinism

`enableCaching: true` memoizes act/observe results against (instruction, DOM snapshot). Subsequent identical requests skip the LLM. Cache lives per `Stagehand` instance unless persisted externally.

`domSettleTimeoutMs` controls how long Stagehand waits for DOM stability before snapshot — raise for SPAs, lower for static pages.
