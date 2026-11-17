# Server path backups

Live sites under `/www/wwwroot` are backed up **per site**, not as one giant wwwroot archive. Database dumps stay on aaPanel’s own schedule; this document covers filesystem (path) backups only.

## Why not one `path_wwwroot` tar

aaPanel’s old job `Backup Directory[/www/wwwroot]` built ~61 GB `path_wwwroot_*.tar.gz` archives. The last successful local builds were **2026-08-22** and **2026-08-23**; the Aug 23 Google Drive upload stalled around 8–9%, and that aaPanel cron (id=2) was left **disabled**. Restoring one site meant scanning tens of gigabytes.

**Do not re-enable** that monolithic path job.

## What runs today

| Piece | Path / schedule | Role |
|-------|-----------------|------|
| Per-site path backup | `/www/backup-sites.sh` daily **02:15** (root) | One `.tar.gz` per site under `/www/backup/sites/<site>/` |
| Source in git | [`scripts/backup/backup-sites.sh`](../scripts/backup/backup-sites.sh) | Copy to `/www/backup-sites.sh` when the script changes |
| DB backups | aaPanel “Backup Database[ALL]” ~01:30 | `/www/backup/database/` |
| Offsite sync | `/www/backup.sh` daily ~00:03 | `rclone copy /www/backup` → `gdrive:/server-backups/ubuntuliteweb/YYYY-MM-DD/` |

Per-site archives exclude rebuildable trees (`node_modules`, `logs`, `.git`, `dist`). They **keep** `public/` (including images, pages, uploads), `data/`, and `content/`. Local retention is **2** newest tars per site.

Skipped wwwroot names: `default`, `public`, anything starting with `liteweb-backup-`, and junk names (spaces / quotes).

Stale monolith archives under `/www/backup/path/wwwroot/` are **excluded** from rclone via `/www/backup-rclone-exclude.txt` (`path/wwwroot/**`) so nightly sync does not re-upload ~122 GB of August-only path tars. Prefer restoring from `/www/backup/sites/<site>/` (or Drive under `…/sites/<site>/`). Keep the old path tars on disk or Drive only as a one-time historical fallback.

## Install / update the script

From a laptop (repo root), as a user with SSH to the server:

```bash
scp scripts/backup/backup-sites.sh litewebchatlb@ubuntu.liteweb.info:/tmp/backup-sites.sh
ssh litewebchatlb@ubuntu.liteweb.info 'sudo install -m 755 /tmp/backup-sites.sh /www/backup-sites.sh'
```

Cron (root), once:

```cron
15 2 * * * /www/backup-sites.sh >> /var/log/site-backup.log 2>&1
```

Leave aaPanel cron id=2 (`Backup Directory[/www/wwwroot]`) disabled.

## Manual run

```bash
# All eligible sites
sudo /www/backup-sites.sh

# One site (smoke / before a risky change)
sudo /www/backup-sites.sh guerrasports
```

Logs: `/var/log/site-backup.log`. Lock: `/var/lock/site-backup.lock` (`flock`; a second run exits if one is already going).

## Restore one site

Archives store the site as a top-level folder name (for example `guerrasports/...`).

```bash
# Example: extract into /www/wwwroot (creates/updates guerrasports/)
sudo tar -xzf /www/backup/sites/guerrasports/site_guerrasports_YYYYMMDD_HHMMSS.tar.gz -C /www/wwwroot
```

To avoid overwriting newer live files, extract to a staging directory first, then copy only the paths you need (for example `public/images`).

Database restore is separate: use a dump from `/www/backup/database/` (or the matching folder on Drive), not the site tar.

## Related

Deploy keeps live `public/images/` and `public/pages/` across deploys (see [deployment.md](deployment.md)). Path backups are the safety net when those trees are lost outside deploy (disk failure, accidental delete, etc.).
