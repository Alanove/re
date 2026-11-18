# @local/json-backup

Atomic JSON file writes with dated snapshots under `data-backups/`.

On each save that changes an existing file, the previous bytes are copied into:

```text
data-backups/<file-name>/daily/YYYY-MM-DD.json
data-backups/<file-name>/weekly/YYYY-Www.json      (Sundays)
data-backups/<file-name>/monthly/YYYY-MM.json      (1st of month)
data-backups/<file-name>/quarterly/YYYY-Qn.json    (1 Jan / Apr / Jul / Oct)
```

A period that already has a snapshot is left alone, so the copy is the file from before the first save of that day, week, month, or quarter. Retention: 7 daily, 8 weekly, 12 monthly, 8 quarterly.

```bash
npm install
npm run check
npm test
npm run build
```

To put the module on a site, see [INSTALL.md](INSTALL.md).
