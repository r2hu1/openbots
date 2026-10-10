# Playwright & Puppeteer

Browserbase exposes a Chrome DevTools Protocol WebSocket per session. Both Playwright and Puppeteer connect to it as a remote browser.

## Table of contents

- [Playwright](#playwright)
- [Puppeteer](#puppeteer)
- [Default context](#default-context)
- [Screenshots & PDFs](#screenshots--pdfs)
- [Navigation patterns](#navigation-patterns)
- [Multi-tab](#multi-tab)
- [Selenium](#selenium)

## Playwright

```typescript
import { chromium } from 'playwright-core';
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });
const session = await bb.sessions.create({ projectId: process.env.BROWSERBASE_PROJECT_ID! });

const browser = await chromium.connectOverCDP(session.connectUrl);
const context = browser.contexts()[0];
const page = context.pages()[0];

await page.goto('https://example.com');
await page.close();
await browser.close();
```

Use `playwright-core` rather than `playwright` — there is no need to download Chromium locally.

## Puppeteer

```typescript
import puppeteer from 'puppeteer-core';
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });
const session = await bb.sessions.create({ projectId: process.env.BROWSERBASE_PROJECT_ID! });

const browser = await puppeteer.connect({ browserWSEndpoint: session.connectUrl });
const [page] = await browser.pages();
await page.goto('https://example.com');
await browser.disconnect();        // disconnect, do not close — keeps VM intact for keepAlive
```

## Default context

Browserbase ships every session with one pre-created `BrowserContext` and one blank `Page`. Calling `browser.newContext()` (Playwright) or `browser.createIncognitoBrowserContext()` (Puppeteer) creates a second context that bypasses session-level fingerprint, proxy, and persistence config.

```typescript
const context = browser.contexts()[0];      // honors browserSettings
const page = context.pages()[0];             // open new tabs with context.newPage()
```

## Screenshots & PDFs

```typescript
await page.screenshot({ path: 'shot.png', fullPage: true });
const pdf = await page.pdf({ format: 'A4' });   // headful Chromium also supports PDF
```

## Navigation patterns

```typescript
await page.goto(url, { waitUntil: 'domcontentloaded' });
// 'load' | 'domcontentloaded' | 'networkidle' | 'commit'

await page.waitForLoadState('networkidle');
await page.waitForSelector('text=Sign in', { timeout: 10_000 });
```

## Multi-tab

```typescript
const [popup] = await Promise.all([
  context.waitForEvent('page'),
  page.click('a[target=_blank]'),
]);
await popup.waitForLoadState();
```

## Selenium

Selenium uses `session.seleniumRemoteUrl` (HTTPS) instead of `connectUrl`:

```typescript
import { Builder } from 'selenium-webdriver';

const driver = await new Builder()
  .forBrowser('chrome')
  .usingServer(session.seleniumRemoteUrl)
  .build();
```

The signing-key header `x-bb-signing-key: ${session.signingKey}` is required on every Selenium request — the @browserbasehq/sdk webdriver helper sets it for you, but raw clients must include it.
