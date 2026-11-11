# Cloudflare cache alignment (PageSpeed / browser TTL)

Express sets `Cache-Control` on static files from [`src/app.ts`](../src/app.ts): **1 year** for most of `public/`, **7 days** for paths under `public/uploads/`.

## Recommended dashboard settings

1. **Caching → Configuration → Browser Cache TTL**  
   Prefer **Respect Existing Headers** so Cloudflare does not shorten the origin TTL (Lighthouse’s “efficient cache lifetimes” audit uses what the browser receives).

2. **If you use Cache Rules (or legacy Page Rules)**  
   Avoid forcing a **4 hour** (or similarly short) edge/browser TTL for `/css/*`, `/js/*`, `/images/*`, `/MultiShop/*`, or `/uploads/*` unless you have a specific reason. Short TTLs at the edge override good origin headers.

3. **Purge**  
   After deploys that change hashed or versioned assets (`?v=ASSET_VERSION`), purge only if needed; CSS is cache-busted via `assetVersion` / `ASSET_VERSION` in [`src/config/env.config.ts`](../src/config/env.config.ts).

4. **Orange cloud**  
   With nginx → Node behind Cloudflare, ensure nginx forwards `X-Forwarded-Proto` (already assumed in app comments) so HTTPS and cookies behave correctly; caching headers are still sent by Node for static files.
