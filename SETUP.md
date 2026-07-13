# Setup

The app is fully client-side, with **no API keys, no secrets, and no services to provision.** Running it locally is two commands; deploying is one. The list below is only this long because deploying to a host needs a one-time login.

## Run locally (30 seconds)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```
3. Open the printed URL (default **http://localhost:5173**), then deal a hand.

No `.env`, no config, no accounts.

## Deploy to Cloudflare Pages (free)

The only manual step is a one-time Cloudflare login.

1. **Log in to Cloudflare** (opens a browser once, then remembers you):
   ```bash
   npx wrangler login
   ```
   For CI or headless use, set a `CLOUDFLARE_API_TOKEN` env var instead, with a token that has the *Cloudflare Pages: Edit* permission.
2. **Build and deploy:**
   ```bash
   npm run deploy
   ```
   The first deploy creates the Pages project named `sirbluffington` (change it in [`wrangler.jsonc`](wrangler.jsonc) and the `deploy` script in `package.json` if you want a different subdomain).
3. Your site is live at **https://sirbluffington.pages.dev** (or your chosen project name).

### Optional: custom domain

In the Cloudflare dashboard → your Pages project → **Custom domains** → add your domain. Cloudflare provisions the certificate automatically. This is the *only* thing in the entire project that could ever cost money, and only if you buy a domain.

## Deploy elsewhere (also free)

The build is just static files in `dist/`, so any static host works:

```bash
npm run build
# then upload dist/ to GitHub Pages, Netlify, etc.
```

For **GitHub Pages** or any host that serves from a subpath, set the correct `base` in [`vite.config.ts`](vite.config.ts) before building.

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs typecheck, lint, test, and build on every push and PR. There is nothing to configure; it works out of the box.
