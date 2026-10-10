# Observability

Each session emits three observable streams: a live debugger URL, an rrweb video recording, and CDP logs. All three are togglable at create time and queryable via the SDK afterwards.

## Table of contents

- [Live debugger / Live View](#live-debugger--live-view)
- [Embedding Live View](#embedding-live-view)
- [Recordings (rrweb)](#recordings-rrweb)
- [Logs](#logs)
- [Session Inspector](#session-inspector)

## Live debugger / Live View

```typescript
const dbg = await bb.sessions.debug(session.id);
// {
//   debuggerUrl,             // chrome-devtools URL
//   debuggerFullscreenUrl,   // hosted full-screen iframe view
//   wsUrl,                   // raw CDP wss
//   pages: [{ id, url, title, faviconUrl, debuggerUrl, debuggerFullscreenUrl }],
// }
```

`debuggerFullscreenUrl` is the embed-friendly viewport. `pages` lists every tab so a UI can switch between them.

## Embedding Live View

```html
<iframe
  src="${debuggerFullscreenUrl}"
  sandbox="allow-same-origin allow-scripts"
  allow="clipboard-read; clipboard-write"
  style="width: 100%; height: 600px; border: 0"
></iframe>
```

The iframe is fully interactive — operators can click and type, useful for human-in-the-loop CAPTCHA fallback or agent supervision.

## Recordings (rrweb)

```typescript
const events = await bb.sessions.recording(session.id);
// rrweb event stream
```

Replay client-side:

```typescript
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';

new rrwebPlayer({
  target: document.getElementById('player')!,
  props: { events },
});
```

`recordSession: false` at session create disables capture entirely — toggle is fixed for the session's lifetime.

## Logs

```typescript
const logs = await bb.sessions.logs(session.id);
// CDP event stream: Console.messageAdded, Network.requestWillBeSent, Page.frameNavigated, etc.
```

Use for post-mortem on automation failures: response codes, console errors, page lifecycle. `logSession: false` disables.

## Session Inspector

The dashboard at `https://browserbase.com/sessions/${session.id}` renders all three streams (live, recording, logs) side-by-side, plus a Stagehand tab when the session was created via Stagehand showing every `act`/`observe`/`extract` call with rationale.
