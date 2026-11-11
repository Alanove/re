# emedicalinstruments.com is not ready

This folder only holds the legacy `wwwroot/` files. It is not a Node site yet, and `scripts/deploy/deploy.ps1` refuses to deploy it while this file exists. Delete this file once every item below is done.

- [ ] Build the site on the shared CMS (`package.json`, `package-lock.json`, `src/`, `admin/`, `views/`, `public/`, `data/`, `content/`), following `docs/site-transformation.md`
- [ ] `transform.config.json` pointing at the legacy `wwwroot/` source
- [ ] `deploy.json` (server folder, port, health path, aaPanel restart settings)
- [ ] Committed `.env` and `.env.production` (`NODE_ENV=production`, `PORT` matching `deploy.json`)
- [ ] `npm run typecheck`, `npm run lint` and `npm run build` pass
- [ ] `media:check:prod` npm script that passes on the server
