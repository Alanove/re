# oceanair-leb.com is not ready

This folder only holds static HTML design proposals (`designs/`) for the client to choose from. There is no CMS site yet, and `scripts/deploy/deploy.ps1` refuses to deploy it while this file exists. Delete this file once every item below is done.

- [ ] Client picks a design direction (`designs/option-1`, `option-2` or `option-3`)
- [ ] Build the site on the shared TypeScript CMS layout (`src/`, `admin/`, `views/`, `public/`, `tsconfig.json`) from the chosen design
- [ ] `transform.config.json` (legacy URL `https://www.oceanair-leb.com/`)
- [ ] `public/scss/_tokens.scss` with the logo palette recorded in `.cursor/rules/sites/oceanair-leb.com/project.mdc`
- [ ] Wire WWA Tracking + Sailing Schedule through Node proxy routes (see `docs/api-integration.md`); put credentials in `.env` / `.env.production`, never in the browser
- [ ] Keep the intro YouTube video (`ioJ2m-B_T3s`); do not revive the broken sailingschedule.com iframe
- [ ] `deploy.json` with server folder, port, health path and aaPanel settings
- [ ] Committed `.env` and `.env.production` (`NODE_ENV=production`, `PORT` matching `deploy.json`)
- [ ] `npm run typecheck`, `npm run lint` and `npm run build` pass
- [ ] `media:check:prod` npm script that passes on the server
