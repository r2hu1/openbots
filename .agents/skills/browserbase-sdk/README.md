# browserbase-sdk

> Expertise for Browserbase — cloud headless Chromium in isolated VMs, driven with Playwright, Puppeteer, Selenium, or Stagehand over a per-session CDP WebSocket.

## What it does

`browserbase-sdk` makes your agent fluent in Browserbase for TypeScript/Node. Browserbase runs production headless browsers in dedicated VMs and exposes a CDP endpoint per session; the `@browserbasehq/sdk` package is a thin REST client for sessions, contexts, extensions, and projects — it does not drive the browser itself. The skill covers:

- **Three integration paths** — raw SDK (session management only), SDK + `playwright-core`/`puppeteer-core` for scripted automation, and Stagehand for AI-driven `act`/`extract`/`observe`/`agent` primitives.
- **Session lifecycle** — the full create/list/retrieve/update/debug surface, `keepAlive`, regions, timeouts, `userMetadata`, and releasing sessions with `REQUEST_RELEASE`.
- **Connection mechanics** — `connectOverCDP` and `puppeteer.connect`, the single-use `connectUrl`, and the default-context gotcha (`browser.contexts()[0]`, never `newContext()`).
- **Persistence and stealth** — Contexts for persistent auth state, Browserbase-managed/external proxies with geolocation, advanced stealth, verified browsers, and captcha solving.
- **Files and observability** — downloads/uploads, live view, rrweb recordings, logs, and live debugger URLs.

It triggers when code imports `@browserbasehq/sdk`, `@browserbasehq/stagehand`, or connects `playwright-core`/`puppeteer-core` to Browserbase, POSTs to `api.browserbase.com`, or uses the `x-bb-api-key` header.

## When to use it

Invoke this skill when you hear:

- *"Spin up a Browserbase session and screenshot a page with Playwright."*
- *"Persist login state across runs so I don't re-authenticate every session."*
- *"Route this scraper through a residential proxy in eu-central-1."*
- *"Use Stagehand to extract structured data from this page with a Zod schema."*
- *"My proxy/fingerprint settings aren't taking effect — why?"* (the default-context gotcha)
- *"Solve the captcha on this flow and keep the session alive after disconnect."*

## Example walkthrough

Asked to open a session and screenshot a page, the skill wires the SDK to `playwright-core` correctly — creating the session, connecting via `chromium.connectOverCDP(session.connectUrl)`, and reaching for the **pre-created** context with `browser.contexts()[0]` rather than `browser.newContext()`, because only that context honors `browserSettings`, proxies, and fingerprint. It then reminds you the session persists past script exit unless released.

## Installation

```bash
npx skills add thatjuan/agent-skills --skill browserbase-sdk
```

## Bundled resources

| File | Purpose |
|------|---------|
| `SKILL.md` | Base URL/auth, three integration paths with quickstarts, session request/response shapes, default-context gotcha, lifecycle, feature map, pitfalls |
| `references/sessions.md` | Full session API — create/list/retrieve/update/debug, lifecycle, regions, keep-alive, metadata |
| `references/playwright-puppeteer.md` | Playwright and Puppeteer connection patterns, default-context gotcha, screenshots, navigation |
| `references/stagehand.md` | Stagehand AI primitives (`act`/`extract`/`observe`/`agent`), constructor params, Model Gateway, BYO LLM |
| `references/contexts.md` | Persistent auth state via Contexts, `persist: true`, the one-context-per-site rule |
| `references/proxies.md` | Browserbase-managed, external, and no-proxy modes, geolocation, `domainPattern` rules |
| `references/stealth-and-captcha.md` | Advanced stealth, verified browsers, captcha solving with custom selectors, ad blocking |
| `references/downloads-uploads.md` | Downloads (`setDownloadBehavior`), uploads (`setInputFiles`, large-file API), file chooser |
| `references/observability.md` | Live view, rrweb recordings, logs, debugger URLs, embedding |
| `references/extensions.md` | Custom extensions via uploaded zip |

## Tips

- **`browser.contexts()[0]`, not `browser.newContext()`.** Only the pre-created context honors `browserSettings.context`, proxies, and fingerprint — the single most common Browserbase bug.
- **`connectUrl` is one-shot.** Reconnecting after a disconnect requires `keepAlive: true`.
- **Sessions outlive your script.** Release with `REQUEST_RELEASE` via `sessions.update`, or let `timeout` expire — `keepAlive` prolongs them further.
- **Stagehand needs `BROWSERBASE_PROJECT_ID`** even though the raw SDK infers it from the API key.
- **`solveCaptchas`, `recordSession`, and `logSession` default to `true`** — disable them explicitly for compliance or privacy-sensitive runs; recording/logging can't be re-enabled mid-session.
- **`verified` and `advancedStealth` are Scale-plan only** and 4xx on lower tiers.

## Related skills

- [`camofox-browser`](../camofox-browser/) — a self-hosted anti-detection browser server as an alternative to cloud sessions
- [`temporal`](../temporal/) — durable orchestration around long-running browser automation
