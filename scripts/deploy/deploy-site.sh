#!/usr/bin/env bash
# Server side of the single-site deploy. scripts/deploy/deploy.ps1 pipes this file over SSH and runs it
# as the www user. The whole body lives in main() so bash has read all of it before anything runs.
set -Eeuo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/www/deploy}"
NODE_ROOT="${NODE_ROOT:-/www/server/nodejs}"
REQUIRED_USER="${REQUIRED_USER:-www}"
KEEP_BUILDS=3
KEEP_DATA_BACKUPS=10
HEALTH_TIMEOUT_SECONDS=30
STOP_TIMEOUT_SECONDS=15
BUILD_DIR=""
KEEP_BUILD=0
trap '[[ -z "$BUILD_DIR" || $KEEP_BUILD -eq 1 ]] || rm -rf "$BUILD_DIR"' EXIT

log() { printf '[deploy %s] %s\n' "$(date +%H:%M:%S)" "$*"; }
warn() { printf '[deploy %s] WARNING: %s\n' "$(date +%H:%M:%S)" "$*" >&2; }
die() { printf '[deploy %s] ERROR: %s\n' "$(date +%H:%M:%S)" "$*" >&2; exit 1; }

regex_escape() { printf '%s' "$1" | sed 's/[][\.*^$+?(){}|/]/\\&/g'; }

kill_tree() {
  local pid="$1" signal="$2" child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$child" "$signal"
  done
  kill "-$signal" "$pid" 2>/dev/null || true
}

port_listener_pid() {
  ss -ltnpH "sport = :$1" 2>/dev/null | grep -oE 'pid=[0-9]+' | head -n 1 | cut -d= -f2 || true
}

port_in_use() {
  [[ -n "$(ss -ltnH "sport = :$1" 2>/dev/null)" ]]
}

find_project_script() {
  local project="$1" server_path="$2" scripts_dir="$NODE_ROOT/vhost/scripts" pattern matches
  if [[ "$project" != "-" ]]; then
    [[ -f "$scripts_dir/$project.sh" ]] || return 1
    printf '%s\n' "$scripts_dir/$project.sh"
    return 0
  fi
  [[ -d "$scripts_dir" ]] || return 1
  pattern="$(regex_escape "$server_path")/?([\"' ;&]|\$)"
  mapfile -t matches < <(grep -lE -- "$pattern" "$scripts_dir"/*.sh 2>/dev/null || true)
  if [[ ${#matches[@]} -eq 1 ]]; then
    printf '%s\n' "${matches[0]}"
    return 0
  fi
  if [[ ${#matches[@]} -gt 1 ]]; then
    warn "Several aaPanel Node projects point at $server_path: ${matches[*]}. Set aapanelProject in deploy.json."
  fi
  return 1
}

resolve_node_bin() {
  local configured="$1" project_script="$2" found
  if [[ "$configured" != "-" ]]; then
    printf '%s\n' "$configured"
    return 0
  fi
  if [[ -n "$project_script" ]]; then
    found="$(grep -oE -- "$(regex_escape "$NODE_ROOT")/v[0-9][^/\"' :]*/bin" "$project_script" | head -n 1 || true)"
    if [[ -n "$found" ]]; then
      printf '%s\n' "$found"
      return 0
    fi
  fi
  found="$(find "$NODE_ROOT" -maxdepth 1 -type d -name 'v[0-9]*' 2>/dev/null | sort -V | tail -n 1 || true)"
  [[ -n "$found" ]] || return 1
  printf '%s/bin\n' "$found"
}

main() {
  [[ $# -eq 11 ]] || die "Expected 11 arguments, got $#. Run deploys through scripts/deploy/deploy.ps1."
  local site="$1" sha="$2" server_path="$3" port="$4" health_path="$5" node_bin_arg="$6" project="$7"
  local restart_b64="$8" protect_list="$9" repo_url="${10}" overwrite_spec="${11}"
  local restart_command=""

  [[ "$(id -un)" == "$REQUIRED_USER" ]] || die "Running as $(id -un); the deploy must run as $REQUIRED_USER."
  [[ "$site" =~ ^[a-z0-9][a-z0-9.-]*$ ]] || die "Invalid site name: $site"
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || die "Invalid commit: $sha"
  [[ "$server_path" =~ ^/[A-Za-z0-9._/-]+$ && "$server_path" != *..* && "$server_path" != "/" ]] || die "Invalid serverPath: $server_path"
  [[ "$port" =~ ^[0-9]+$ ]] || die "Invalid port: $port"
  [[ "$health_path" =~ ^/[A-Za-z0-9._/?=\&-]*$ ]] || die "Invalid healthPath: $health_path"
  local -a overwrite_items=()
  local entry
  if [[ "$overwrite_spec" != "-" && "$overwrite_spec" != "all" ]]; then
    IFS=':' read -r -a overwrite_items <<< "$overwrite_spec"
    for entry in "${overwrite_items[@]}"; do
      [[ "$entry" =~ ^(data|content)/[A-Za-z0-9._/-]+$ && "$entry" != *..* ]] || die "Invalid data file to overwrite: $entry"
    done
  fi
  if [[ "$restart_b64" != "-" ]]; then
    restart_command="$(printf '%s' "$restart_b64" | base64 -d)" || die "restartCommand is not valid base64"
  fi

  local tool
  for tool in git rsync flock tar ss base64 pgrep; do
    command -v "$tool" >/dev/null 2>&1 || die "$tool is not installed on the server."
  done

  umask 022
  local repo_dir="$DEPLOY_ROOT/repo" builds_dir="$DEPLOY_ROOT/builds/$site" state_dir="$DEPLOY_ROOT/state/$site"
  mkdir -p "$builds_dir" "$state_dir/env-backups" "$state_dir/data-backups" "$DEPLOY_ROOT/.npm"

  exec 9>"$state_dir/deploy.lock"
  flock -n 9 || die "Another deploy of $site is already running."

  [[ -d "$server_path" ]] || die "Site folder $server_path does not exist. Create the site in aaPanel first."
  [[ -w "$server_path" ]] || die "$REQUIRED_USER cannot write to $server_path. Run: chown -R $REQUIRED_USER:$REQUIRED_USER $server_path"

  local project_script=""
  if [[ -z "$restart_command" ]]; then
    project_script="$(find_project_script "$project" "$server_path" || true)"
    [[ -n "$project_script" ]] || die "No aaPanel Node project found for $server_path in $NODE_ROOT/vhost/scripts. Set aapanelProject or restartCommand in deploy.json."
    log "aaPanel project script: $project_script"
  fi

  local node_bin
  node_bin="$(resolve_node_bin "$node_bin_arg" "$project_script" || true)"
  [[ -n "$node_bin" && -x "$node_bin/node" ]] || die "Node.js not found (looked for $node_bin/node). Set nodeBin in deploy.json."
  export PATH="$node_bin:$PATH"
  export npm_config_cache="$DEPLOY_ROOT/.npm"
  export HOME="$DEPLOY_ROOT"
  unset NODE_ENV
  log "Node $(node -v), npm $(npm -v) from $node_bin"

  local key
  for key in "$DEPLOY_ROOT/.ssh/id_ed25519" "$DEPLOY_ROOT/.ssh/id_rsa"; do
    if [[ -f "$key" ]]; then
      export GIT_SSH_COMMAND="ssh -i $key -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=$DEPLOY_ROOT/.ssh/known_hosts"
      break
    fi
  done

  if [[ ! -d "$repo_dir" ]]; then
    log "Cloning $repo_url into $repo_dir"
    git clone --bare --quiet "$repo_url" "$repo_dir" || die "git clone failed. Check the deploy key in $DEPLOY_ROOT/.ssh."
  fi
  log "Fetching from $repo_url"
  git -C "$repo_dir" fetch --quiet --prune "$repo_url" '+refs/heads/*:refs/heads/*' || die "git fetch failed. Check the deploy key in $DEPLOY_ROOT/.ssh."
  git -C "$repo_dir" cat-file -e "$sha^{commit}" 2>/dev/null || die "Commit $sha is not on GitHub. Push it first."
  git -C "$repo_dir" cat-file -e "$sha:websites/$site/.env.production" 2>/dev/null || die "websites/$site/.env.production is not in commit $sha."

  local build_dir
  build_dir="$builds_dir/$(date +%Y%m%d-%H%M%S)-${sha:0:8}"
  BUILD_DIR="$build_dir"
  mkdir -p "$build_dir"

  log "Extracting websites/$site at ${sha:0:8} into $build_dir"
  git -C "$repo_dir" archive "$sha" "websites/$site" | tar -x -C "$build_dir" --strip-components=2
  [[ -f "$build_dir/package-lock.json" ]] || die "websites/$site has no package-lock.json in commit $sha."
  for entry in "${overwrite_items[@]}"; do
    [[ -f "$build_dir/$entry" ]] || die "$entry is not in commit $sha, so it cannot overwrite the server copy."
  done
  local env_port
  env_port="$(sed -nE 's/^[[:space:]]*PORT[[:space:]]*=[[:space:]]*["'\'']?([0-9]+).*/\1/p' "$build_dir/.env.production" | head -n 1)"
  if [[ -n "$env_port" && "$env_port" != "$port" ]]; then
    die ".env.production sets PORT=$env_port but deploy.json port is $port."
  fi

  log "Installing dependencies (npm ci)"
  (cd "$build_dir" && npm ci --include=dev --no-audit --no-fund) || die "npm ci failed."
  log "Building (npm run build)"
  (cd "$build_dir" && npm run build) || die "npm run build failed."
  (cd "$build_dir" && npm prune --omit=dev --no-audit --no-fund) || die "npm prune failed."
  [[ -f "$build_dir/dist/src/server.js" ]] || die "Build did not produce dist/src/server.js."

  local previous_build=""
  if [[ -f "$state_dir/current" ]]; then
    previous_build="$(cat "$state_dir/current")"
    [[ -d "$previous_build" ]] || previous_build=""
  fi

  if [[ -f "$server_path/.env" ]] && ! cmp -s "$server_path/.env" "$build_dir/.env.production"; then
    local backup="$state_dir/env-backups/.env.$(date +%Y%m%d-%H%M%S)"
    install -m 600 "$server_path/.env" "$backup"
    log "Server .env differs from .env.production; previous copy saved to $backup"
  fi

  local -a excludes=(
    --exclude=/.env --exclude='/.env.*' --exclude=/deploy.json
    --exclude=/data/ --exclude=/content/ --exclude=/public/uploads/
    --exclude=/logs/ --exclude=/.user.ini --exclude=/.htaccess --exclude=/.well-known/
  )
  local item
  if [[ "$protect_list" != "-" ]]; then
    IFS=':' read -r -a protect_items <<< "$protect_list"
    for item in "${protect_items[@]}"; do
      excludes+=("--exclude=/$item")
    done
  fi

  local data_backup=""
  if [[ "$overwrite_spec" != "-" ]]; then
    local -a backup_dirs=()
    for item in data content; do
      [[ -d "$server_path/$item" ]] && backup_dirs+=("$item")
    done
    if [[ ${#backup_dirs[@]} -gt 0 ]]; then
      data_backup="$state_dir/data-backups/data-$(date +%Y%m%d-%H%M%S).tar.gz"
      tar -czf "$data_backup" -C "$server_path" "${backup_dirs[@]}" || die "Could not back up server data; nothing was changed."
      chmod 600 "$data_backup"
      log "Server data backed up to $data_backup"
    fi
  fi

  overwrite_data() {
    local source="$1" dir changed
    if [[ "$overwrite_spec" == "all" ]]; then
      for dir in data content; do
        [[ -d "$source/$dir" ]] || continue
        mkdir -p "$server_path/$dir" || return 1
        changed="$(rsync -a --checksum --itemize-changes --out-format='%n' "$source/$dir/" "$server_path/$dir/")" || return 1
        while IFS= read -r item; do
          [[ -n "$item" && "$item" != */ ]] && log "Overwrote $dir/$item from git"
        done <<< "$changed"
      done
      return 0
    fi
    for item in "${overwrite_items[@]}"; do
      if cmp -s "$source/$item" "$server_path/$item"; then
        log "$item already matches git"
        continue
      fi
      install -D -m 644 "$source/$item" "$server_path/$item" || return 1
      log "Overwrote $item from git"
    done
  }

  restore_data() {
    [[ -n "$data_backup" ]] || return 0
    log "Restoring server data from $data_backup"
    tar -xzf "$data_backup" -C "$server_path"
  }

  sync_build() {
    local source="$1" with_overwrite="$2" dir
    rsync -a --delete "${excludes[@]}" "$source/" "$server_path/" || return 1
    for dir in data content public/uploads; do
      if [[ -d "$source/$dir" ]]; then
        mkdir -p "$server_path/$dir" || return 1
        rsync -a --ignore-existing "$source/$dir/" "$server_path/$dir/" || return 1
      fi
    done
    if [[ "$with_overwrite" == "yes" && "$overwrite_spec" != "-" ]]; then
      overwrite_data "$source" || return 1
    fi
    install -m 600 "$source/.env.production" "$server_path/.env" || return 1
  }

  stop_site() {
    local pid_file="" pid waited
    if [[ -n "$project_script" ]]; then
      pid_file="$NODE_ROOT/vhost/pids/$(basename "$project_script" .sh).pid"
    fi
    if [[ -n "$pid_file" && -f "$pid_file" ]]; then
      pid="$(tr -dc '0-9' < "$pid_file")"
      if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
        log "Stopping PID $pid"
        kill_tree "$pid" TERM
      fi
    fi
    for ((waited = 0; waited < STOP_TIMEOUT_SECONDS; waited++)); do
      port_in_use "$port" || return 0
      sleep 1
    done
    pid="$(port_listener_pid "$port")"
    if [[ -n "$pid" ]]; then
      warn "Port $port still in use by PID $pid; forcing it to stop"
      kill_tree "$pid" KILL
      sleep 1
    fi
    if port_in_use "$port"; then
      warn "Port $port is held by a process $REQUIRED_USER cannot stop."
      return 1
    fi
  }

  restart_site() {
    if [[ -n "$restart_command" ]]; then
      log "Restarting with restartCommand from deploy.json"
      (cd "$server_path" && bash -c "$restart_command" 9>&-) || return 1
      return 0
    fi
    stop_site || return 1
    log "Starting with $project_script"
    (cd "$server_path" && setsid nohup bash "$project_script" >/dev/null 2>&1 < /dev/null 9>&- &) || return 1
  }

  site_healthy() {
    local url="http://127.0.0.1:$port$health_path" waited
    for ((waited = 0; waited < HEALTH_TIMEOUT_SECONDS; waited++)); do
      if node --input-type=module -e "try { const r = await fetch(process.argv[1], { redirect: 'manual' }); process.exit(r.status < 400 ? 0 : 1); } catch { process.exit(1); }" "$url"; then
        log "Health check passed: $url"
        return 0
      fi
      sleep 1
    done
    warn "Health check failed after ${HEALTH_TIMEOUT_SECONDS}s: $url"
    return 1
  }

  media_check() {
    if ! grep -q '"media:check:prod"' "$server_path/package.json"; then
      warn "$site has no media:check:prod script; media check skipped."
      return 0
    fi
    log "Running npm run media:check:prod"
    (cd "$server_path" && npm run --silent media:check:prod) || return 1
  }

  log "Syncing build into $server_path"
  local failed=0
  sync_build "$build_dir" yes || failed=1
  if [[ $failed -eq 0 ]]; then
    restart_site || failed=1
  fi
  if [[ $failed -eq 0 ]]; then
    site_healthy || failed=1
  fi
  if [[ $failed -eq 0 ]]; then
    media_check || failed=1
  fi

  if [[ $failed -ne 0 ]]; then
    if [[ -z "$previous_build" ]]; then
      restore_data || warn "Restoring server data failed; the backup is $data_backup"
      die "Deploy of $site failed and there is no previous build to roll back to. Check the aaPanel project log."
    fi
    warn "Deploy failed; rolling back to $previous_build"
    if restore_data && sync_build "$previous_build" no && restart_site && site_healthy; then
      die "Deploy of ${sha:0:8} failed. $site was rolled back to $(basename "$previous_build")."
    fi
    die "Deploy failed AND rollback failed. $site may be down; check the aaPanel project log."
  fi

  KEEP_BUILD=1
  printf '%s\n' "$build_dir" > "$state_dir/current"
  printf '%s\n' "$sha" > "$state_dir/current.sha"
  printf '%s %s %s\n' "$(date -Iseconds)" "$sha" "$(basename "$build_dir")" >> "$state_dir/history.log"

  local old
  while IFS= read -r old; do
    [[ "$old" == "$build_dir" || "$old" == "$previous_build" ]] && continue
    rm -rf "$old"
  done < <(find "$builds_dir" -mindepth 1 -maxdepth 1 -type d | sort -r | tail -n +$((KEEP_BUILDS + 1)))
  find "$state_dir/data-backups" -maxdepth 1 -name 'data-*.tar.gz' | sort -r | tail -n +$((KEEP_DATA_BACKUPS + 1)) | xargs -r rm -f

  log "Deployed $site at ${sha:0:8}."
}

main "$@" < /dev/null; exit $?
