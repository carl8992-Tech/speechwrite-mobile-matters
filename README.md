# SpeechWrite Matters (mobile test)

Standalone phone home-screen web app for browsing and opening Scribe Copilot drafts.

**Not** part of the Chrome Companion extension.

## Local

```bash
npm run dev
```

Open the URL on your phone (same Wi‑Fi), or deploy for HTTPS then **Add to Home Screen** in Safari.

## Deploy (Cloudflare Pages)

```bash
npm run deploy
```

Requires Cloudflare login via Wrangler the first time.

## Notes

- Uses the same T-Pro auth + NLP dictation APIs as Scribe/Companion.
- Mobile vs desktop is a soft hint (Actionstep `as:` link / encounter shape), not version alone.
- If the browser blocks API calls (CORS), next step is a tiny Cloudflare Worker proxy.
