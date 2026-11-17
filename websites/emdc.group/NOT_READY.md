# emdc.group is not ready

This site has not been brought up to the shared CMS standards yet. `scripts/deploy/deploy.ps1` refuses to deploy it while this file exists. Delete this file once every item below is done.

- [x] `deploy.json` created (server folder, aaPanel project)
- [ ] Set `port` in `deploy.json` (the deploy stops while it is `null`)
- [x] Build entry is `dist/src/app.js` (deploy accepts `dist/src/server.js` or `dist/src/app.js`; aaPanel runs `npm start`)
- [ ] Committed `.env` (`.env.production` exists; check it sets `NODE_ENV=production` and a `PORT` matching `deploy.json`)
- [ ] `transform.config.json`
- [ ] `typecheck` and `lint` npm scripts; `npm run typecheck`, `npm run lint` and `npm run build` pass
- [ ] `media:check:prod` npm script that passes on the server
