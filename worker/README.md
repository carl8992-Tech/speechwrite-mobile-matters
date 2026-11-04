# Optional Cloudflare Worker proxy

Use this only if the phone browser blocks SpeechWrite APIs with CORS.

```bash
npx wrangler login
npx wrangler deploy
```

Then set `window.SW_API_PROXY = "https://your-worker.workers.dev"` before `app.js` (or we can wire it in).
