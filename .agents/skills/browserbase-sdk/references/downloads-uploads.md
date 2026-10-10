# Downloads & uploads

Browser-side file transfer in Browserbase needs CDP-level configuration: downloads sync to cloud storage only when the browser writes them to the literal directory `"downloads"`.

## Table of contents

- [Downloads — Playwright](#downloads--playwright)
- [Downloads — Puppeteer](#downloads--puppeteer)
- [Downloads API](#downloads-api)
- [Direct uploads (Playwright)](#direct-uploads-playwright)
- [Large-file uploads via API](#large-file-uploads-via-api)
- [File chooser in Live View](#file-chooser-in-live-view)

## Downloads — Playwright

```typescript
const browser = await chromium.connectOverCDP(session.connectUrl);
const context = browser.contexts()[0];
const page = context.pages()[0];

const client = await context.newCDPSession(page);
await client.send('Browser.setDownloadBehavior', {
  behavior: 'allow',
  downloadPath: 'downloads',         // literal — not /tmp/downloads
  eventsEnabled: true,
});

const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.click('a#export'),
]);

await download.saveAs(`./local/${download.suggestedFilename()}`); // optional local copy
```

Filenames synced to Browserbase get a Unix-millisecond suffix to avoid collisions: `report.pdf` → `report-1719265797164.pdf`.

## Downloads — Puppeteer

```typescript
const browser = await puppeteer.connect({ browserWSEndpoint: session.connectUrl });
const [page] = await browser.pages();

const client = await page.createCDPSession();
await client.send('Browser.setDownloadBehavior', {
  behavior: 'allow',
  downloadPath: 'downloads',
  eventsEnabled: true,
});
```

## Downloads API

```typescript
const list = await bb.sessions.downloads.list(session.id, {
  filename: 'report*',         // glob
  mimeType: 'application/pdf',
  minSize: 1024,
  maxSize: 10_000_000,
  createdAfter: '2026-01-01T00:00:00Z',
  limit: 50,                   // 1–100, default 20
});

for (const d of list.data) {
  // d.id, d.sessionId, d.filename, d.mimeType, d.size, d.checksum (sha256), d.createdAt
  const file = await bb.sessions.downloads.retrieve(session.id, d.id); // streams bytes
  // pipe file to disk / S3 / etc.
}

await bb.sessions.downloads.delete(session.id, downloadId);
```

Large files sync in real time — wrap retrieves in retry-with-backoff if a download just completed.

## Direct uploads (Playwright)

```typescript
await page.setInputFiles('input[type=file]', './fixtures/photo.jpg');
await page.setInputFiles('input[type=file]', [
  './a.csv',
  './b.csv',
]);
```

Paths are relative to the script's CWD. The file is streamed to the Browserbase VM and attached to the input element.

## Large-file uploads via API

For files exceeding the inline transfer limit, upload first then attach via CDP:

```typescript
import fs from 'node:fs';

const upload = await bb.sessions.uploads.create(session.id, {
  file: fs.createReadStream('./big-archive.zip'),
});
// upload.id, upload.path

const client = await page.context().newCDPSession(page);
const { backendNodeId } = await client.send('DOM.getDocument').then(/* ...resolve input element... */);
await client.send('DOM.setFileInputFiles', {
  files: [upload.path],
  backendNodeId,
});
```

## File chooser in Live View

When a human or remote agent triggers a file picker via Live View, intercept it programmatically — the remote browser cannot see the operator's local disk:

```typescript
page.on('filechooser', async (chooser) => {
  await chooser.setFiles('./fixtures/photo.jpg');
});
```
