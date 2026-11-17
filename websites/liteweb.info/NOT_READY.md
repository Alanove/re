# liteweb.info is not ready

This site was imported from its own repository and has not been brought up to the shared CMS standards yet. `scripts/deploy/deploy.ps1` refuses to deploy it while this file exists. Delete this file once every item below is done.

- [ ] Move to the shared TypeScript CMS layout (`src/`, `admin/`, `views/`, `tsconfig.json`); it is currently a plain Node site
- [x] `deploy.json` created (server folder, aaPanel project)
- [ ] Set `port` in `deploy.json` (the deploy stops while it is `null`)
- [ ] Build entry must be `dist/src/server.js` or `dist/src/app.js` (deploy checks for either; aaPanel runs `npm start`); this site currently starts from `scripts/server.js`
- [ ] Committed `.env` and `.env.production` (`NODE_ENV=production`, `PORT` matching `deploy.json`)
- [ ] `transform.config.json`
- [ ] `typecheck` and `lint` npm scripts; `npm run typecheck`, `npm run lint` and `npm run build` pass
- [ ] `media:check:prod` npm script that passes on the server
