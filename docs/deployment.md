# Deploying a site

Sites are deployed one at a time from a laptop with `scripts/deploy/deploy.ps1`. The server is Ubuntu with aaPanel, and every site runs as an aaPanel Node Project under the `www` user.

```powershell
.\scripts\deploy\deploy.ps1 -Site thronetrading.com
```

If PowerShell blocks the script, run it as
`powershell -ExecutionPolicy Bypass -File scripts\deploy\deploy.ps1 -Site thronetrading.com`.

## What a deploy does

1. On the laptop:
   - checks that the site folder and `packages/` have no uncommitted changes and that local `HEAD` equals `origin/main`
   - checks that `.env.production` is committed, sets `NODE_ENV=production` and uses the same `PORT` as `deploy.json`
   - runs `npm run typecheck`, `npm run lint` and `npm run build`
   - asks you to type the site name to confirm
2. Connects over SSH and runs [scripts/deploy/deploy-site.sh](../scripts/deploy/deploy-site.sh) on the server as `www`. The script is sent each time, so nothing has to be updated on the server.
3. On the server:
   - fetches the commit from GitHub into `/www/deploy/repo`
   - extracts `websites/<domain>` into `/www/deploy/builds/<domain>/<time>-<sha>/`
   - runs `npm ci` (Linux sharp binaries come from the lockfile), `npm run build` and `npm prune --omit=dev` there; the live site is not touched until the build succeeds
4. Copies the build into the site folder (`serverPath`):
   - **Code**, including `dist`, `src`, `views`, `admin`, `public` (except uploads), `node_modules` and `package*.json`, is mirrored exactly. Old files are removed.
   - **`data/`, `content/`, `public/uploads/`**: new files from git are added, but files that already exist on the server are never overwritten or deleted. Admin edits made on the live site are kept. To overwrite them on purpose, see "Intentionally overwriting live data" below.
   - **`.env`** is written from the commit's `.env.production` with mode 600. If the server `.env` was different, the old copy is saved in `/www/deploy/state/<domain>/env-backups/`.
   - **Never touched**: `deploy.json`, `logs/`, `.user.ini`, `.htaccess`, `.well-known/` and anything listed in `protect`.
5. Stops the running process from aaPanel's PID file and starts it again with aaPanel's own start script, so the panel still shows the right status.
6. Checks `http://127.0.0.1:<port><healthPath>` for up to 30 seconds, then runs `npm run media:check:prod` if the site has that script.
7. If any step after the copy fails, the script copies the previous build back, restarts it and exits with an error. The last 3 builds are kept.

## Intentionally overwriting live data

By default the server's `data/` and `content/` win. To push the committed versions over the live ones:

```powershell
# Only the listed files (names without a folder are taken from data/)
.\scripts\deploy\deploy.ps1 -Site thronetrading.com -DataFiles settings.json,menus.json

# Every committed file in data/ and content/
.\scripts\deploy\deploy.ps1 -Site thronetrading.com -OverwriteData
```

- **Confirmation:** the summary shows the files in yellow, and you must type `OVERWRITE` after the site name. `-Yes` skips both prompts.
- **What's never overwritten:** `data/users.json` and `data/submissions.json` are not in git, so they are never touched. `public/uploads/` is never overwritten or cleaned either. Server data files that are not in git are kept.
- **Backup:** the server's `data/` and `content/` are saved to `/www/deploy/state/<domain>/data-backups/data-<time>.tar.gz` before anything changes. The last 10 backups are kept.
- **Logging:** each file that actually changed is listed in the deploy output.
- **On failure:** if the deploy fails (build, health check or media check), the backup is restored before the previous build goes back online.
- **Both flags given:** if you pass both, `-DataFiles` is used.
- **Restoring a backup by hand:** `sudo -u www tar -xzf /www/deploy/state/<domain>/data-backups/<file> -C <serverPath>`, then restart the project in aaPanel.

## Rollback or redeploy an older commit

```powershell
.\scripts\deploy\deploy.ps1 -Site thronetrading.com -Ref 1a2b3c4d
```

The commit must already be on `origin/main`. Local build checks are skipped for `-Ref`, because that commit is not checked out on the laptop. The server still builds it from scratch. Deploy history is in `/www/deploy/state/<domain>/history.log`.

Other options: `-SkipChecks` skips the local typecheck, lint and build. `-Yes` skips the confirmation prompt.

## Per-site settings: `websites/<domain>/deploy.json`

```json
{
  "serverPath": "/www/wwwroot/thronetrading.com",
  "port": 3042,
  "healthPath": "/",
  "nodeBin": null,
  "aapanelProject": null,
  "restartCommand": null,
  "protect": []
}
```

| Field | Meaning |
| --- | --- |
| `serverPath` | Site folder on the server. It can be named differently from the local folder. |
| `port` | Port the site listens on. Must match `PORT` in `.env.production`. |
| `healthPath` | Path that must answer with a 2xx or 3xx status after the restart. |
| `nodeBin` | Node `bin` folder. `null` uses the version from the aaPanel project's start script. |
| `aapanelProject` | aaPanel project name. `null` finds the project whose start script points at `serverPath`. |
| `restartCommand` | Optional shell command, run as `www` in `serverPath`, that replaces the aaPanel restart. |
| `protect` | Extra paths, relative to `serverPath`, that a deploy must never change or delete. |

A site without `deploy.json` cannot be deployed. New sites need one.

## Environment files

Each site commits `.env` (laptop development) and `.env.production` (server). The deploy always writes the server `.env` from `.env.production`, so change production settings in git and redeploy. Edits made directly on the server are overwritten by the next deploy, although a backup is kept.

## Laptop setup (once per laptop)

Run everything in PowerShell. Replace `<server-ip>` with the server's IP address. `litewebchatlb` is the SSH login user on the server.

1. **Get the repo and tools.** Install Git and Node.js 22.12 or newer. Windows 10 and 11 already include `ssh`; check with `ssh -V`. Then:

   ```powershell
   git clone https://github.com/Alanove/re.git C:\ai\tests\re
   cd C:\ai\tests\re
   ```

2. **Create an SSH key for this laptop** (skip if `$env:USERPROFILE\.ssh\id_ed25519` already exists):

   ```powershell
   ssh-keygen -t ed25519 -C "$env:USERNAME@$env:COMPUTERNAME"
   ```

   Press Enter at every question, including the passphrase. The deploy runs SSH without prompts, so a key with a passphrase only works if Windows' `ssh-agent` service is running and the key was added with `ssh-add`.

3. **Allow this laptop to log in to the server.** This uses your server password one last time:

   ```powershell
   Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub | ssh litewebchatlb@<server-ip> "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
   ```

   If password login is disabled on the server, copy the printed key from `Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub`. On the server, add it as a new line in `~/.ssh/authorized_keys` for `litewebchatlb`.

4. **Test the key and the `www` permission together:**

   ```powershell
   ssh -o BatchMode=yes litewebchatlb@<server-ip> "sudo -n -u www id"
   ```

   It must print `uid=1001(www) ...` without asking for anything.
   - If it asks for a password, step 3 didn't work.
   - If it says `sudo: a password is required`, the sudoers rule from server setup step 2 is missing.

5. **Create the local deploy config.** This file is gitignored, so every laptop needs its own:

   ```powershell
   Copy-Item scripts\deploy\deploy.local.example.json scripts\deploy\deploy.local.json
   notepad scripts\deploy\deploy.local.json
   ```

   The example already has the right values: `host` `ubuntu.liteweb.info`, `user` `litewebchatlb`, `runAs` `www`. Only change `identityFile` if your key has a different file name.

6. **Install each site's dependencies** so the local checks can run:

   ```powershell
   cd websites\thronetrading.com; npm ci; cd ..\..
   ```

7. **Deploy.** Commit and push first, because only pushed commits are deployed:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\deploy\deploy.ps1 -Site thronetrading.com
   ```

## Server setup (once)

Run these as root, or as a user with sudo.

1. **Tools**: `apt install -y git rsync` (`flock`, `ss` and `pgrep` are already part of Ubuntu).
2. **SSH user**: create or choose the login user, add your laptop's public key to `~<user>/.ssh/authorized_keys`, and let it run commands as `www` without a password:

   ```bash
   echo 'deploy ALL=(www) NOPASSWD: ALL' > /etc/sudoers.d/deploy-www
   chmod 440 /etc/sudoers.d/deploy-www
   visudo -c
   ```

   If you log in as root, this step is not needed.
3. **Deploy workspace and GitHub deploy key**:

   ```bash
   mkdir -p /www/deploy/.ssh
   ssh-keygen -t ed25519 -N '' -C 'aapanel-deploy' -f /www/deploy/.ssh/id_ed25519
   chown -R www:www /www/deploy
   chmod 700 /www/deploy/.ssh
   cat /www/deploy/.ssh/id_ed25519.pub
   ```

   On GitHub, open the repository, go to Settings > Deploy keys > Add deploy key, paste the public key and leave write access off. The first deploy clones the repo into `/www/deploy/repo` by itself.
4. **aaPanel Node Project, for each site**:
   - **Project folder**: the site's `serverPath`. Make sure `www` owns it: `chown -R www:www /www/wwwroot/<domain>`.
   - **Start command**: `npm start` (runs `node dist/src/server.js`).
   - **Port**: the same as `deploy.json`.
   - **Run user**: `www`.
   - **Node version**: 22.12 or newer (the server's v22.20.0 is fine; 24 LTS also works). Older versions fail during `npm run build` because the current `sass` and `eslint` releases need them.
5. **Check the aaPanel paths**:

   ```bash
   ls -l /www/server/nodejs/vhost/scripts /www/server/nodejs/vhost/pids
   ```

   The deploy finds the project script whose contents mention the site's `serverPath`. Both folders must be writable by `www`, or at least the site's `.pid` file and start script must be. If they are owned by root, either `chown www` the files for that project or set `restartCommand` in `deploy.json`.
6. **First deploy**: the server's current `.env` is replaced by `.env.production`. Before the first deploy, copy any real values from the server `.env` (SMTP settings, for example) into `.env.production` and commit them. Changing `SESSION_SECRET` only logs admins out once.

## Troubleshooting

| Message | Fix |
| --- | --- |
| `sudo: a password is required` | The sudoers rule from server setup step 2 is missing. |
| `git fetch failed` | The deploy key is not on GitHub, or `/www/deploy/.ssh` is not owned by `www`. |
| `No aaPanel Node project found` | Set `aapanelProject` to the project name shown in `/www/server/nodejs/vhost/scripts`. |
| `Port ... held by a process www cannot stop` | The site was started as root. Stop it once in aaPanel, set the run user to `www`, and deploy again. |
| `Health check failed` | Read the aaPanel project log. The path is on the `nohup` line of `/www/server/nodejs/vhost/scripts/<project>.sh`, usually `/www/server/nodejs/vhost/logs/<project>.log` or `/www/wwwlogs/nodejs/<project>.log`. The previous build is already back online. |
| `media:check:prod` fails | sharp is on its WebAssembly fallback or uploads are not writable. See `.cursor/rules/cms-media.mdc`. |

`re-petroleum.com` has no `media:check:prod` script yet, so its deploy skips that check and prints a warning.
