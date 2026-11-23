# Server Configuration

This folder holds server configuration files that are deployed separately from the application code.

## Nginx

| File | Purpose | Where to put it on the server |
|---|---|---|
| `nginx-main.conf` | Main site — proxies `guerrasports.com` to Node.js on port 3007 | `/www/server/panel/vhost/nginx/guerrasports.com.conf` |
| `nginx-www-redirect.conf` | Redirects `www.guerrasports.com` → `guerrasports.com` (301) | `/www/server/panel/vhost/nginx/www.guerrasports.com.conf` |

## aaPanel deployment

1. In aaPanel, add `www.guerrasports.com` as a **separate website** (same SSL cert folder as main site)
2. Go to that site's **Config** tab and replace everything with the contents of `nginx-www-redirect.conf`
3. The main site (`guerrasports.com`) config is already managed by aaPanel — only edit it via aaPanel's **Config** tab (not the settings dropdowns, which regenerate the file)
4. After saving: **Test** → **Reload nginx** (buttons inside aaPanel)

## Verify after deploy

```bash
# On the server
curl -I https://www.guerrasports.com/
# Expected: 301 Location: https://guerrasports.com/

curl -I https://guerrasports.com/
# Expected: 200 OK
```

## Cloudflare

- Keep orange cloud **ON** for both `guerrasports.com` and `www.guerrasports.com`
- Cloudflare will cache the `www` 301 redirect at the edge
- `trust proxy` in `app.ts` is set to `2` (Cloudflare + nginx)
