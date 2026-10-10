# Stealth, fingerprinting, captcha

Browserbase frames anti-detection as "Agent Identity" — partnerships with bot-protection providers plus a purpose-built Chromium with realistic fingerprints. The flags below are session-level configuration.

## Table of contents

- [solveCaptchas](#solvecaptchas)
- [Custom captcha selectors](#custom-captcha-selectors)
- [advancedStealth](#advancedstealth)
- [verified](#verified)
- [blockAds](#blockads)
- [OS fingerprint](#os-fingerprint)
- [ignoreCertificateErrors](#ignorecertificateerrors)

## solveCaptchas

Default: `true`. Browserbase auto-resolves reCAPTCHA, hCaptcha, Cloudflare Turnstile, and similar (typical 5–30 sec). To opt out:

```typescript
browserSettings: { solveCaptchas: false }
```

Disable for compliance audits, captcha-handling tests, or sites whose ToS forbids automated solving.

## Custom captcha selectors

Override automatic detection for non-standard captcha widgets:

```typescript
browserSettings: {
  solveCaptchas: true,
  captchaImageSelector: '#challenge img.captcha',
  captchaInputSelector: '#challenge input[name=captcha_text]',
}
```

Browserbase grabs the image from `captchaImageSelector` and types the answer into `captchaInputSelector`.

## advancedStealth

Scale-plan only. Adds extra fingerprint randomization, JS-stack hardening, and timing jitter on top of the default profile.

```typescript
browserSettings: { advancedStealth: true }
```

## verified

Scale-plan only. Premium fingerprint profile recognized by Browserbase's bot-protection partners as legitimate.

```typescript
browserSettings: { verified: true }
```

Combine with `proxies: true` and a `Context` for the highest pass-through rate against aggressive WAFs.

## blockAds

Default: `false`. Drops third-party ad/tracker requests (uBlock-style filter list) — often the largest source of proxy bandwidth.

```typescript
browserSettings: { blockAds: true }
```

## OS fingerprint

```typescript
browserSettings: {
  os: 'mac',     // 'windows' | 'mac' | 'linux' | 'mobile' | 'tablet'
  verified: true, // os requires verified on Scale
}
```

`mobile` and `tablet` adjust UA + viewport hints; combine with a small `viewport` for consistency.

## ignoreCertificateErrors

Default: `true`. Browserbase ignores TLS errors so internal staging hosts with self-signed certs work out of the box. Set `false` to enforce strict TLS:

```typescript
browserSettings: { ignoreCertificateErrors: false }
```
