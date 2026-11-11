# santamariabouar.com is not ready

This site was imported from its own repository and has not been brought up to the shared CMS standards yet. `scripts/deploy/deploy.ps1` refuses to deploy it while this file exists. Delete this file once every item below is done.

- [x] `deploy.json` created (server folder, aaPanel project, database migrations)
- [ ] Set `port` in `deploy.json` (the deploy stops while it is `null`)
- [ ] Build output must include `dist/src/server.js` (the server deploy checks for it and aaPanel runs `npm start`); this site currently starts from `dist/src/app.js`
- [ ] Check the existing `.env` and `.env.production` (`NODE_ENV=production`, `PORT` matching `deploy.json`)
- [ ] `transform.config.json`
- [ ] `typecheck` and `lint` npm scripts; `npm run typecheck`, `npm run lint` and `npm run build` pass
- [ ] `media:check:prod` npm script that passes on the server
