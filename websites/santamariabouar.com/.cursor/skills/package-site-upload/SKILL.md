---
name: package-site-upload
description: >-
  Builds a copy-and-overlay deploy folder and zip of changed site files so they
  can be uploaded onto the production project root (aaPanel). Use when the user
  asks to package changes, package for upload, make a deploy overlay, or prepare
  files to copy onto the live site.
---

# Package site changes for upload

Production is updated by copying files onto the project root (the folder that has `package.json` and `.env.production`), then restarting the Node app in aaPanel. Do not deploy with git pull unless the user says so.

## What to include

Default set: uncommitted and untracked files from `git status`. If the user names a commit or files, package those instead.

Include a file only when it belongs on the server:

- App source: `src/`, `admin/` (except `admin/scripts/` one-offs), `views/`, `public/` (css, js, images that are part of the change)
- New `data-migration/` scripts that production must run

Leave out:

- `.env*`, credentials, `node_modules/`, `dist/`, `coverage/`, logs
- `public/uploads/`, `data-backup/`, SQL dumps, docs, tests
- The `deploy/` folder itself
- `README.md` inside the package (it stays beside the zip, not on the server)

If `public/css/**/*.scss` or `admin/public/css/**/*.scss` changed, compile first (`npm run scss:once` or `npm run scss-all`) and include the generated `.css` (and `.map` if it is already tracked).

If `src/**/*.ts` or `admin/**/*.ts` changed (not `admin/scripts/` or `data-migration/`), run `npm run build` locally and fix errors before packaging. Do not put `dist/` in the package. Production runs `npm run build` after the copy.

## Build the package

1. Pick a short slug from the change, e.g. `unpaid-report-print`.
2. Run:

```powershell
powershell -NoProfile -File .cursor/skills/package-site-upload/scripts/package-upload.ps1 -Name <slug> -Files <repo-relative paths>
```

3. Write `deploy/<slug>/README.md` after the script (the script does not overwrite an existing README). Use this shape:

```markdown
# Deploy: <title>

Copy or extract onto the production project root. Do not copy this README.

Example: `deploy/<slug>/src/app.ts` → `/site-root/src/app.ts`

Zip: `deploy/<slug>.zip` extracts to the same paths. Extract it in the project root.

## What this release changes

- ...

## Files

- `path/to/file`

## After copy

<only the commands that apply>

Then restart the Node app in aaPanel (or `npm run start:production`).
```

After-copy commands, include only what applies:

- Any `.ts` under `src/` or `admin/` (controllers, services, routes): `npm run build`
- Any new file under `data-migration/`: `npm run migrate:production`, then `npm run migrate:status:production`
- EJS, static JS, or already-compiled CSS only: no build and no migrate
- `package.json` or lockfile dependency changes: `npm install`, then `npm run build`

## Commit

`deploy/` is gitignored. Commit and push the real source changes only when the user asks. Do not commit the overlay folder or the zip.

## Tell the user

Give the zip path, the file list, and the exact after-copy commands. Say that `README.md` stays off the server.
