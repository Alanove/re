# @local/json-backup

Atomic JSON file writes with dated snapshots under `data-backups/`.

On each save that changes an existing file, the previous bytes are copied into:

```text
data-backups/<path-under-data>/daily/YYYY-MM-DD.json
data-backups/<path-under-data>/weekly/YYYY-Www.json      (Sundays)
data-backups/<path-under-data>/monthly/YYYY-MM.json      (1st of month)
data-backups/<path-under-data>/quarterly/YYYY-Qn.json    (1 Jan / Apr / Jul / Oct)
```

`data/pages.json` snapshots as `data-backups/pages.json/...`. A nested file such as `data/articles/5.json` snapshots as `data-backups/articles/5.json/...`.

A period that already has a snapshot is left alone, so the copy is the file from before the first save of that day, week, month, or quarter. Retention: 7 daily, 8 weekly, 12 monthly, 8 quarterly.

```bash
npm install
npm run check
npm test
npm run build
```

To put the module on a site, see [INSTALL.md](INSTALL.md).
