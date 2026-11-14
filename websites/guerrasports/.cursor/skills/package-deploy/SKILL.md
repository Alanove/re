---
name: package-deploy
description: >-
  Packages the current Guerra Sports git changes into a dated deploy folder
  and public.zip for upload, then commits the source when asked. Use when
  the user asks to package changes into the deploy folder, prepare a deploy
  zip, or check those changes into git.
---

# Package deploy and commit

`deploy/` is gitignored. Each package is `deploy/YYYY-MM-DD/` (local date) and mirrors repo-relative paths, plus `deploy/YYYY-MM-DD/public.zip` with the same paths. Do not delete other date folders. If today's folder already exists, replace its contents.

## What to copy

Copy modified and untracked files that belong in the release:

- TypeScript, EJS, SCSS/CSS, `public/js/app.js`, `public/js/app.min.js`
- Locales, `data/admin-menu.json`, `src/database/schema.sql`
- `data-migration/` scripts for this change

Also copy each changed `.ts` file's compiled `dist/**/*.js` (same relative path). Run `npm run build` first if `dist` is missing or older than the source. Do not copy `.map` or `.d.ts`.

## What to leave out

- `node_modules`, `.env`, `.env.production`, `cert`, `logs`
- Uploaded media: `public/images/products/`, `public/images/slide/`, `public/images/homepage/`, `public/pages/`
- The `deploy/` tree itself and `.cursor/skills/`

## Zip

After the files are copied, zip the date folder to a temp file, then move it to `public.zip` inside that folder. Do not put the zip inside itself.

## Commit

Commit only when the user asked to check in. Follow the repo commit rules. Stage the source files that were packaged, not `deploy/`, not uploaded media, and not secrets. `dist/` is gitignored.
