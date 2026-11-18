# Installing json-backup on a site

Step by step for adding save-time JSON snapshots to a site in `websites/<domain>/`. Paths below are relative to that site folder unless they start with `packages/`. `websites/solutec-lb.com` is the first complete example.

## 1. Build the module into the site

Add this script to the site's `package.json`:

```json
"json-backup:build": "node ../../packages/json-backup/build.mjs --out src/vendor/json-backup"
```

From the site folder:

```bash
cd packages/json-backup && npm install && cd -
npm run json-backup:build
```

It writes `src/vendor/json-backup/writeJsonFileSync.ts`. Commit that file. Never edit it by hand; change the package and rebuild.

## 2. Switch JSON saves

Replace each live `fs.writeFileSync(path, JSON.stringify(...))` (or equivalent) with:

```ts
import { writeJsonFileSync } from '../src/vendor/json-backup/writeJsonFileSync';

writeJsonFileSync(filePath, JSON.stringify(data, null, 2));
```

Adjust the import path for the file you are in. Leave one-off import or migration scripts on a plain write unless you want those to snapshot too.

## 3. Keep snapshots off git and off deploy deletes

Add to the site's `.gitignore` (create the file if needed):

```
data-backups/
```

Add `data-backups` to `deploy.json` `protect`, so `rsync --delete` during deploy does not remove the folder:

```json
"protect": [
  "data-backups"
]
```

Merge with any existing `protect` entries.

## 4. Verify

```bash
cd packages/json-backup && npm run check && npm test
cd websites/<domain> && npm run typecheck && npm run lint && npm run build
```

Save something in the admin panel, then check `data-backups/<file-name>/daily/` for today's snapshot.

## Restore

Copy a snapshot over the live file and restart the site:

```bash
cp data-backups/pages.json/daily/2026-11-18.json data/pages.json
```

On the server, run the same copy as `www` inside the site folder, then restart the aaPanel Node project.
