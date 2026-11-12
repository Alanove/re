# zadwbarakat.com is not ready

This site is being converted from the legacy ASP.NET site to the shared CMS. `scripts/deploy/deploy.ps1` refuses to deploy it while this file exists. Delete this file once every item below is done.

- [x] `deploy.json` created (port 3054, aaPanel project `zadwbarakat`)
- [x] Committed `.env` and `.env.production` (`PORT=3054`)
- [x] `transform.config.json` with the crawl seeds and legacy paths
- [x] Full crawl of the live site finished (`npm run crawl:legacy`) and `content/crawl/coverage.json` reviewed
- [x] `npm run import:legacy` and `npm run download:assets` run, with every article, book, hymn, album and video imported
- [x] `npm run typecheck`, `npm run lint` and `npm run build` pass
- [ ] `npm run media:check` passes locally (done) and `npm run media:check:prod` passes on the server (after the first deploy)
- [x] Browser pass done: home, every section, articles (Arabic and French), library filters, hymn player, albums, videos, search (including "الصلاه" finding "الصلاة"), contact, newsletter and admin
- [ ] 68 images and files referenced by legacy articles are missing from the local wwwroot copy (entries with `"status": "missing"` in `data/asset-manifest.json`); supply them or accept the gaps
- [ ] Owner has reviewed the new design and the content
- [ ] DNS for www.zadwbarakat.com points to the server and the aaPanel project exists
