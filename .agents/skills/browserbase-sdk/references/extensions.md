# Extensions

Custom Chrome extensions load into a Browserbase session via uploaded zip. Use cases: ad blockers beyond `blockAds`, scraping helpers, password managers (1Password integration), enterprise auth.

## Upload

```typescript
import fs from 'node:fs';

const ext = await bb.extensions.create({
  file: fs.createReadStream('./my-extension.zip'),
});
console.log(ext.id);
```

The zip mirrors a standard Chrome extension layout — `manifest.json` at root, MV3 supported. Browserbase scans for malformed manifests at upload time.

## Use in a session

```typescript
const session = await bb.sessions.create({
  projectId,
  extensionId: ext.id,
});
```

`extensionId` is per-session — pass it again for each new session that needs the extension.

## List / retrieve / delete

```typescript
const all = await bb.extensions.list();
const one = await bb.extensions.retrieve(ext.id);
await bb.extensions.delete(ext.id);
```

## BYOS

On Scale plans with Bring Your Own Storage, extensions live in the customer's S3 bucket under `extensions/{extensionId}/`, and the IAM role needs read-only access there. Extensions sync from S3 on session boot.
