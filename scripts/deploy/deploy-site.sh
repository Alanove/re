#!/usr/bin/env bash
# Server side of the single-site deploy. scripts/deploy/deploy.ps1 pipes this file over SSH and runs it
# as the www user. The whole body lives in main() so bash has read all of it before anything runs.
set -Eeuo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/www/deploy}"
NODE_ROOT="${NODE_ROOT:-/www/server/nodejs}"
REQUIRED_USER="${REQUIRED_USER:-www}"
KEEP_BUILDS=3
KEEP_DATA_BACKUPS=10
KEEP_DB_BACKUPS=5
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

env_value() {
  local key="$1" file="$2" value
  value="$(sed -nE "s/^[[:space:]]*(export[[:space:]]+)?${key}[[:space:]]*=[[:space:]]*//p" "$file" | tail -n 1 | tr -d '\r')"
  if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then
    value="${BASH_REMATCH[1]}"
  fi
  printf '%s' "$value"
}

# Relative path inside websites/<site>. Returns 0 if npm ci is required.
path_needs_deps() {
  case "$1" in
    package.json|package-lock.json|.npmrc) return 0 ;;
    *) return 1 ;;
  esac
}

# Relative path inside websites/<site>. Returns 0 if npm run build is required.
path_needs_build() {
  local p="$1"
  path_needs_deps "$p" && return 0
  case "$p" in
    src|src/*|scripts|scripts/*|public/scss|public/scss/*) return 0 ;;
    prisma|prisma/*) return 0 ;;
    next.config.js|next.config.mjs|next.config.ts|tailwind.config.js|tailwind.config.ts|postcss.config.js|postcss.config.mjs) return 0 ;;
    tsconfig.json|tsconfig.*.json) return 0 ;;
    *.scss) return 0 ;;
    *) return 1 ;;
  esac
}

# Paths the live site owns (never deleted / never overwritten unless overwrite flags).
is_live_owned_path() {
  case "$1" in
    data|data/*|content|content/*) return 0 ;;
    public/uploads|public/uploads/*|public/images|public/images/*|public/pages|public/pages/*) return 0 ;;
    deploy.json|logs|logs/*|.user.ini|.htaccess|.well-known|.well-known/*) return 0 ;;
    node_modules|node_modules/*|.env|.env.*) return 0 ;;
    *) return 1 ;;
  esac
}

is_protected_path() {
  local rel="$1" item
  for item in "${protect_items[@]+"${protect_items[@]}"}"; do
    [[ -n "$item" ]] || continue
    if [[ "$rel" == "$item" || "$rel" == "$item"/* ]]; then
      return 0
    fi
  done
  return 1
}

copy_tree() {
  local src="$1" dest="$2"
  [[ -e "$src" ]] || return 1
  mkdir -p "$(dirname "$dest")"
  rm -rf "$dest"
  cp -a "$src" "$dest"
}

# Unlink then extract one path from git so hardlinked previous-build inodes stay intact.
extract_git_path() {
  local repo="$1" commit="$2" site_name="$3" rel="$4" dest="$5"
  local git_path="websites/$site_name/$rel"
  rm -f "$dest/$rel"
  mkdir -p "$(dirname "$dest/$rel")"
  git -C "$repo" archive "$commit" "$git_path" | tar -x -C "$dest" --strip-components=2 \
    || die "Could not extract $git_path from ${commit:0:8}."
}

main() {
  [[ $# -eq 16 ]] || die "Expected 16 arguments, got $#. Run deploys through scripts/deploy/deploy.ps1."
  local site="$1" sha="$2" server_path="$3" port="$4" health_path="$5" node_bin_arg="$6" project="$7"
  local restart_b64="$8" protect_list="$9" repo_url="${10}" overwrite_spec="${11}"
  local migrations_dir="${12}" migrations_script="${13}" migrations_mode="${14}" build_mode="${15}"
  local laptop_base_sha="${16}"
  local restart_command=""

  [[ "$(id -un)" == "$REQUIRED_USER" ]] || die "Running as $(id -un); the deploy must run as $REQUIRED_USER."
  [[ "$site" =~ ^[a-z0-9][a-z0-9._-]*$ && "$site" != *..* ]] || die "Invalid site name: $site"
  if [[ "$migrations_script" != "-" ]]; then
    [[ "$migrations_dir" =~ ^[A-Za-z0-9._-][A-Za-z0-9._/-]*$ && "$migrations_dir" != *..* ]] || die "Invalid migrations dir: $migrations_dir"
    [[ "$migrations_script" =~ ^[A-Za-z0-9][A-Za-z0-9:._-]*$ ]] || die "Invalid migrations script: $migrations_script"
  fi
  [[ "$migrations_mode" == "auto" || "$migrations_mode" == "force" ]] || die "Invalid migrations mode: $migrations_mode"
  [[ "$build_mode" == "auto" || "$build_mode" == "full" ]] || die "Invalid build mode: $build_mode"
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || die "Invalid commit: $sha"
  [[ "$laptop_base_sha" == "-" || "$laptop_base_sha" =~ ^[0-9a-f]{40}$ ]] || die "Invalid base commit: $laptop_base_sha"
  [[ "$server_path" =~ ^/[A-Za-z0-9._/-]+$ && "$server_path" != *..* && "$server_path" != "/" ]] || die "Invalid serverPath: $server_path"
  [[ "$port" =~ ^[0-9]+$ ]] || die "Invalid port: $port"
  [[ "$health_path" =~ ^/[A-Za-z0-9._/?=\&-]*$ ]] || die "Invalid healthPath: $health_path"
  local -a overwrite_items=()
  local -a protect_items=()
  local entry
  if [[ "$overwrite_spec" != "-" && "$overwrite_spec" != "all" ]]; then
    IFS=':' read -r -a overwrite_items <<< "$overwrite_spec"
    for entry in "${overwrite_items[@]}"; do
      [[ "$entry" =~ ^(data|content)/[A-Za-z0-9._/-]+$ && "$entry" != *..* ]] || die "Invalid data file to overwrite: $entry"
    done
  fi
  if [[ "$protect_list" != "-" ]]; then
    IFS=':' read -r -a protect_items <<< "$protect_list"
    for entry in "${protect_items[@]}"; do
      [[ "$entry" =~ ^[A-Za-z0-9._-][A-Za-z0-9._/-]*$ && "$entry" != *..* ]] || die "Invalid protect path: $entry"
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
  mkdir -p "$builds_dir" "$state_dir/env-backups" "$state_dir/data-backups" "$state_dir/db-backups" "$DEPLOY_ROOT/.npm"
  # SSH often starts in the login user's home, which www cannot access; find(1) then fails
  # restoring cwd after walking db-backups. Work from the deploy root instead.
  cd "$DEPLOY_ROOT" || die "Cannot cd to $DEPLOY_ROOT"

  exec 9>"$state_dir/deploy.lock"
  flock -n 9 || die "Another deploy of $site is already running."

  [[ -d "$server_path" ]] || die "Site folder $server_path does not exist. Create the site in aaPanel first."
  [[ -w "$server_path" ]] || die "$REQUIRED_USER cannot write to $server_path. Run: chown -R $REQUIRED_USER:$REQUIRED_USER $server_path"

  local project_script=""
  if [[ -z "$restart_command" ]]; then
    project_script="$(find_project_script "$project" "$server_path" || true)"
    [[ -n "$project_script" ]] || die "No aaPanel Node project found for $server_path in $NODE_ROOT/vhost/scripts. Set aapanelProject or restartCommand in deploy.json."
    log "aaPanel project script: $project_script"
    local project_log project_log_dir
    project_log="$(grep -oE '>>[[:space:]]*/[^[:space:]]+' "$project_script" | head -n 1 | sed -E 's/^>>[[:space:]]*//' || true)"
    if [[ -n "$project_log" ]]; then
      project_log_dir="$(dirname "$project_log")"
      if [[ -e "$project_log" && ! -w "$project_log" ]] || [[ ! -e "$project_log" && ! -w "$project_log_dir" ]]; then
        die "The aaPanel start script logs to $project_log, which $REQUIRED_USER cannot write, so the site could not start. In aaPanel set the project's run user to $REQUIRED_USER (aaPanel then logs to a folder $REQUIRED_USER can write), or set restartCommand in deploy.json."
      fi
    fi
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

  local previous_sha="" previous_build=""
  [[ -f "$state_dir/current.sha" ]] && previous_sha="$(tr -dc '0-9a-f' < "$state_dir/current.sha")"
  if [[ -f "$state_dir/current" ]]; then
    previous_build="$(cat "$state_dir/current")"
    [[ -d "$previous_build" ]] || previous_build=""
  fi
  if [[ -n "$previous_sha" ]] && ! git -C "$repo_dir" cat-file -e "$previous_sha^{commit}" 2>/dev/null; then
    warn "Previous deploy SHA ${previous_sha:0:8} is not in the bare repo; treating this as a full build"
    previous_sha=""
  fi
  if [[ -n "$laptop_base_sha" && "$laptop_base_sha" != "-" && -n "$previous_sha" && "$laptop_base_sha" != "$previous_sha" ]]; then
    warn "Laptop base ${laptop_base_sha:0:8} differs from server current.sha ${previous_sha:0:8}; using the server commit"
  fi

  if [[ "$build_mode" != "full" && -n "$previous_sha" && "$previous_sha" == "$sha" ]]; then
    log "$site is already deployed at ${sha:0:8}; nothing to do (pass -Full to rebuild)."
    KEEP_BUILD=1
    exit 0
  fi

  local need_deps=1 need_build=1 use_delta=0
  local -a changed_rels=() deleted_rels=()
  local prefix="websites/$site/"

  if [[ "$build_mode" == "full" ]]; then
    log "Full build forced (-Full)"
  elif [[ -z "$previous_sha" || -z "$previous_build" ]]; then
    log "No reusable previous build; running full npm ci and build"
  else
    use_delta=1
    need_deps=0
    need_build=0
    local status old_git new_git rel
    while IFS=$'\t' read -r status old_git new_git; do
      [[ -n "$status" ]] || continue
      case "$status" in
        R*|C*)
          rel="${old_git#"$prefix"}"
          if [[ "$rel" != "$old_git" ]]; then
            deleted_rels+=("$rel")
          fi
          rel="${new_git#"$prefix"}"
          [[ "$rel" != "$new_git" && -n "$rel" ]] || continue
          changed_rels+=("$rel")
          ;;
        D)
          rel="${old_git#"$prefix"}"
          [[ "$rel" != "$old_git" ]] || continue
          deleted_rels+=("$rel")
          continue
          ;;
        *)
          rel="${old_git#"$prefix"}"
          [[ "$rel" != "$old_git" ]] || continue
          changed_rels+=("$rel")
          ;;
      esac
      if path_needs_deps "$rel"; then
        need_deps=1
        need_build=1
      elif path_needs_build "$rel"; then
        need_build=1
      fi
    done < <(git -C "$repo_dir" diff --name-status -M "$previous_sha" "$sha" -- "websites/$site")

    if [[ $need_deps -eq 1 ]]; then
      log "Dependencies changed since ${previous_sha:0:8}; running npm ci and build"
    elif [[ $need_build -eq 1 ]]; then
      log "Build inputs changed since ${previous_sha:0:8}; reusing node_modules when possible, running build"
    else
      log "No dependency or build-input changes since ${previous_sha:0:8}; reusing node_modules and dist"
    fi
    log "Delta: ${#changed_rels[@]} changed, ${#deleted_rels[@]} deleted under websites/$site"
  fi

  local build_dir
  build_dir="$builds_dir/$(date +%Y%m%d-%H%M%S)-${sha:0:8}"
  BUILD_DIR="$build_dir"

  if [[ $use_delta -eq 1 ]]; then
    log "Hardlinking previous build $(basename "$previous_build") -> $(basename "$build_dir")"
    if ! cp -al "$previous_build" "$build_dir"; then
      warn "Hardlink copy failed; falling back to full extract"
      rm -rf "$build_dir"
      use_delta=0
      need_deps=1
      need_build=1
      mkdir -p "$build_dir"
      log "Extracting websites/$site at ${sha:0:8} into $build_dir"
      git -C "$repo_dir" archive "$sha" "websites/$site" | tar -x -C "$build_dir" --strip-components=2
    else
      local rel
      for rel in "${deleted_rels[@]}"; do
        rm -rf "$build_dir/$rel"
      done
      for rel in "${changed_rels[@]}"; do
        extract_git_path "$repo_dir" "$sha" "$site" "$rel" "$build_dir"
      done
      # Compiled CSS / dist stay hardlinked until a build rewrites them.
    fi
  else
    mkdir -p "$build_dir"
    log "Extracting websites/$site at ${sha:0:8} into $build_dir"
    git -C "$repo_dir" archive "$sha" "websites/$site" | tar -x -C "$build_dir" --strip-components=2
  fi

  [[ -f "$build_dir/package-lock.json" ]] || die "websites/$site has no package-lock.json in commit $sha."
  for entry in "${overwrite_items[@]}"; do
    [[ -f "$build_dir/$entry" ]] || die "$entry is not in commit $sha, so it cannot overwrite the server copy."
  done
  local env_port
  env_port="$(sed -nE 's/^[[:space:]]*PORT[[:space:]]*=[[:space:]]*["'\'']?([0-9]+).*/\1/p' "$build_dir/.env.production" | head -n 1)"
  if [[ -n "$env_port" && "$env_port" != "$port" ]]; then
    die ".env.production sets PORT=$env_port but deploy.json port is $port."
  fi

  ensure_dev_deps() {
    if [[ -x "$build_dir/node_modules/.bin/tsc" || -x "$build_dir/node_modules/.bin/tsx" ]]; then
      return 0
    fi
    log "Dev tooling missing in staging node_modules; running npm install --include=dev"
    # Break hardlinks to the previous build's pruned modules before reinstalling.
    if [[ -d "$build_dir/node_modules" ]]; then
      rm -rf "$build_dir/node_modules"
    fi
    (cd "$build_dir" && npm install --include=dev --no-audit --no-fund) || die "npm install --include=dev failed."
  }

  if [[ $need_deps -eq 1 ]]; then
    if [[ -d "$build_dir/node_modules" ]]; then
      log "Removing staging node_modules before npm ci"
      rm -rf "$build_dir/node_modules"
    fi
    log "Installing dependencies (npm ci)"
    (cd "$build_dir" && npm ci --include=dev --no-audit --no-fund) || die "npm ci failed."
  elif [[ $need_build -eq 1 ]]; then
    if [[ $use_delta -eq 0 ]]; then
      if [[ -n "$previous_build" && -d "$previous_build/node_modules" ]]; then
        log "Reusing node_modules from $(basename "$previous_build")"
        copy_tree "$previous_build/node_modules" "$build_dir/node_modules" || die "Could not copy node_modules from previous build."
      fi
    fi
    ensure_dev_deps
  elif [[ $use_delta -eq 0 && -n "$previous_build" && -d "$previous_build/node_modules" ]]; then
    log "Reusing node_modules from $(basename "$previous_build")"
    copy_tree "$previous_build/node_modules" "$build_dir/node_modules" || die "Could not copy node_modules from previous build."
  fi

  if [[ $need_build -eq 1 ]]; then
    # Unlink hardlinked dist/css/.next outputs so the build does not mutate the previous build.
    if [[ $use_delta -eq 1 ]]; then
      if [[ -d "$build_dir/dist" ]]; then
        rm -rf "$build_dir/dist"
      fi
      if [[ -d "$build_dir/.next" ]]; then
        rm -rf "$build_dir/.next"
      fi
      for entry in public/css/main.css admin/public/css/admin.css; do
        [[ -e "$build_dir/$entry" ]] && rm -f "$build_dir/$entry"
      done
    fi
    log "Building (npm run build)"
    (cd "$build_dir" && npm run build) || die "npm run build failed."
  else
    if [[ $use_delta -eq 0 ]]; then
      log "Reusing dist/.next and compiled CSS from $(basename "$previous_build")"
      if [[ -d "$previous_build/dist" ]]; then
        copy_tree "$previous_build/dist" "$build_dir/dist" || die "Could not copy dist from previous build."
      fi
      if [[ -d "$previous_build/.next" ]]; then
        copy_tree "$previous_build/.next" "$build_dir/.next" || die "Could not copy .next from previous build."
      fi
      if [[ -f "$previous_build/public/css/main.css" ]]; then
        mkdir -p "$build_dir/public/css"
        cp -a "$previous_build/public/css/main.css" "$build_dir/public/css/main.css" \
          || die "Could not copy main.css from previous build."
      fi
      if [[ -f "$previous_build/admin/public/css/admin.css" ]]; then
        mkdir -p "$build_dir/admin/public/css"
        cp -a "$previous_build/admin/public/css/admin.css" "$build_dir/admin/public/css/admin.css" \
          || die "Could not copy admin.css from previous build."
      fi
    else
      log "Reusing hardlinked dist/.next and compiled CSS from $(basename "$previous_build")"
    fi
  fi

  local db_backup="" migrations_ran=0
  if [[ "$migrations_script" != "-" ]]; then
    local migrations_needed=0
    if [[ "$migrations_mode" == "force" ]]; then
      log "Migrations forced (-ForceMigrations)"
      migrations_needed=1
    elif [[ -z "$previous_sha" ]]; then
      log "No earlier deploy of $site is recorded; running migrations"
      migrations_needed=1
    elif ! git -C "$repo_dir" diff --quiet "$previous_sha" "$sha" -- "websites/$site/$migrations_dir"; then
      log "$migrations_dir changed since ${previous_sha:0:8}; running migrations"
      migrations_needed=1
    else
      log "$migrations_dir unchanged since ${previous_sha:0:8}; migrations skipped"
    fi

    if [[ $migrations_needed -eq 1 ]]; then
      command -v mysqldump >/dev/null 2>&1 || die "mysqldump is not installed on the server, so the database cannot be backed up before migrating. Install it (apt install -y mysql-client) or add the aaPanel MySQL bin folder to PATH. Nothing was changed."
      local db_host db_port db_user db_password db_name
      db_host="$(env_value DB_HOST "$build_dir/.env.production")"
      db_port="$(env_value DB_PORT "$build_dir/.env.production")"
      db_user="$(env_value DB_USER "$build_dir/.env.production")"
      db_password="$(env_value DB_PASSWORD "$build_dir/.env.production")"
      db_name="$(env_value DB_NAME "$build_dir/.env.production")"
      [[ -n "$db_name" && -n "$db_user" ]] || die ".env.production must set DB_NAME and DB_USER for the pre-migration backup. Nothing was changed."
      [[ -n "$db_host" ]] || db_host="localhost"
      [[ -n "$db_port" ]] || db_port="3306"

      db_backup="$state_dir/db-backups/db-$(date +%Y%m%d-%H%M%S).sql.gz"
      log "Backing up database $db_name to $db_backup"
      if ! (umask 077 && MYSQL_PWD="$db_password" mysqldump --host="$db_host" --port="$db_port" --user="$db_user" \
          --single-transaction --routines --triggers --no-tablespaces -- "$db_name" | gzip > "$db_backup.partial"); then
        rm -f "$db_backup.partial"
        die "Database backup failed, so migrations were not run. Nothing was changed."
      fi
      mv "$db_backup.partial" "$db_backup"
      find "$state_dir/db-backups" -maxdepth 1 -name 'db-*.sql.gz' | sort -r | tail -n +$((KEEP_DB_BACKUPS + 1)) | xargs -r rm -f

      ensure_dev_deps
      log "Running npm run $migrations_script"
      (cd "$build_dir" && npm run "$migrations_script") || die "Migrations failed. The live site was not changed. Database backup from before the migrations: $db_backup"
      migrations_ran=1
    fi
  fi

  # Keep staging node_modules intact (including devDependencies) so the next incremental
  # deploy can hardlink and rebuild without reinstalling. Live site installs separately.
  if [[ -f "$build_dir/dist/src/server.js" ]]; then
    log "Build entry: dist/src/server.js"
  elif [[ -f "$build_dir/dist/src/app.js" ]]; then
    log "Build entry: dist/src/app.js"
  elif [[ -d "$build_dir/.next" ]]; then
    log "Build entry: .next (Next.js)"
  else
    die "Build did not produce dist/src/server.js, dist/src/app.js, or .next/."
  fi

  if [[ -f "$server_path/.env" ]] && ! cmp -s "$server_path/.env" "$build_dir/.env.production"; then
    local backup="$state_dir/env-backups/.env.$(date +%Y%m%d-%H%M%S)"
    install -m 600 "$server_path/.env" "$backup"
    log "Server .env differs from .env.production; previous copy saved to $backup"
  fi

  local -a excludes=(
    --exclude=/.env --exclude='/.env.*' --exclude=/deploy.json
    --exclude=/data/ --exclude=/content/ --exclude=/public/uploads/
    --exclude=/public/images/ --exclude=/public/pages/
    --exclude=/node_modules/
    --exclude=/logs/ --exclude=/.user.ini --exclude=/.htaccess --exclude=/.well-known/
  )
  local item
  for item in "${protect_items[@]+"${protect_items[@]}"}"; do
    [[ -n "$item" ]] && excludes+=("--exclude=/$item")
  done

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

  # Install production deps in the live site folder (server npm cache / registry),
  # instead of rsyncing node_modules from the build dir (very slow on disk).
  sync_live_node_modules() {
    local source="$1" force_install="$2"
    local live_lock="$server_path/package-lock.json" src_lock="$source/package-lock.json"
    if [[ "$force_install" != "yes" && $need_deps -eq 0 \
        && -d "$server_path/node_modules" \
        && -f "$live_lock" && -f "$src_lock" ]] \
      && cmp -s "$live_lock" "$src_lock"; then
      log "Live node_modules already matches package-lock.json; skipping npm ci"
      return 0
    fi
    log "Installing production dependencies in $server_path (npm ci --omit=dev)"
    (cd "$server_path" && npm ci --omit=dev --no-audit --no-fund) || return 1
  }

  sync_path_to_live() {
    local source="$1" rel="$2"
    if is_protected_path "$rel" || is_live_owned_path "$rel"; then
      return 0
    fi
    if [[ -d "$source/$rel" ]]; then
      mkdir -p "$server_path/$rel" || return 1
      rsync -a --delete "$source/$rel/" "$server_path/$rel/" || return 1
      return 0
    fi
    if [[ -e "$source/$rel" ]]; then
      mkdir -p "$(dirname "$server_path/$rel")" || return 1
      # Unlink first so a hardlinked previous live file is not truncated in place.
      rm -f "$server_path/$rel"
      cp -a "$source/$rel" "$server_path/$rel" || return 1
      return 0
    fi
    return 0
  }

  remove_live_path() {
    local rel="$1"
    if is_protected_path "$rel" || is_live_owned_path "$rel"; then
      return 0
    fi
    if [[ -e "$server_path/$rel" || -L "$server_path/$rel" ]]; then
      rm -rf "$server_path/$rel" || return 1
      log "Removed $rel from live site"
    fi
  }

  sync_live_owned_additions() {
    local source="$1" dir
    for dir in data content public/uploads public/images public/pages; do
      if [[ -d "$source/$dir" ]]; then
        mkdir -p "$server_path/$dir" || return 1
        rsync -a --ignore-existing "$source/$dir/" "$server_path/$dir/" || return 1
      fi
    done
  }

  # Full mirror used for cold deploys and rollback.
  sync_build_full() {
    local source="$1" with_overwrite="$2" force_npm="${3:-no}" dir
    rsync -a --delete "${excludes[@]}" "$source/" "$server_path/" || return 1
    for dir in data content public/uploads public/images public/pages; do
      if [[ -d "$source/$dir" ]]; then
        mkdir -p "$server_path/$dir" || return 1
        rsync -a --ignore-existing "$source/$dir/" "$server_path/$dir/" || return 1
      fi
    done
    if [[ "$with_overwrite" == "yes" && "$overwrite_spec" != "-" ]]; then
      overwrite_data "$source" || return 1
    fi
    sed '1s/^\xEF\xBB\xBF//' "$source/.env.production" | install -m 600 /dev/stdin "$server_path/.env" || return 1
    sync_live_node_modules "$source" "$force_npm" || return 1
  }

  # Copy only paths that changed in this deploy.
  sync_build_delta() {
    local source="$1" with_overwrite="$2" force_npm="${3:-no}" rel
    for rel in "${deleted_rels[@]}"; do
      remove_live_path "$rel" || return 1
    done
    for rel in "${changed_rels[@]}"; do
      if [[ "$rel" == data/* || "$rel" == content/* ]]; then
        continue
      fi
      sync_path_to_live "$source" "$rel" || return 1
    done
    if [[ $need_build -eq 1 ]]; then
      if [[ -d "$source/dist" ]]; then
        mkdir -p "$server_path/dist" || return 1
        rsync -a --delete "$source/dist/" "$server_path/dist/" || return 1
      fi
      if [[ -d "$source/.next" ]]; then
        mkdir -p "$server_path/.next" || return 1
        rsync -a --delete "$source/.next/" "$server_path/.next/" || return 1
      fi
      for rel in public/css/main.css admin/public/css/admin.css; do
        if [[ -f "$source/$rel" ]]; then
          mkdir -p "$(dirname "$server_path/$rel")" || return 1
          rm -f "$server_path/$rel"
          cp -a "$source/$rel" "$server_path/$rel" || return 1
        fi
      done
    fi
    sync_live_owned_additions "$source" || return 1
    if [[ "$with_overwrite" == "yes" && "$overwrite_spec" != "-" ]]; then
      overwrite_data "$source" || return 1
    fi
    sed '1s/^\xEF\xBB\xBF//' "$source/.env.production" | install -m 600 /dev/stdin "$server_path/.env" || return 1
    sync_live_node_modules "$source" "$force_npm" || return 1
  }

  sync_build() {
    local source="$1" with_overwrite="$2" force_npm="${3:-no}"
    if [[ $use_delta -eq 1 && "$force_npm" != "yes" ]]; then
      sync_build_delta "$source" "$with_overwrite" "$force_npm"
    else
      sync_build_full "$source" "$with_overwrite" "$force_npm"
    fi
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

  if [[ $use_delta -eq 1 ]]; then
    log "Syncing changed paths into $server_path (delta; node_modules installed on the live path when needed)"
  else
    log "Syncing build into $server_path (full; node_modules installed on the live path)"
  fi
  local failed=0
  # Forward deploy: never force live npm unless deps changed (need_deps).
  sync_build "$build_dir" yes no || failed=1
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
    if [[ $migrations_ran -eq 1 ]]; then
      warn "The database was already migrated and is not rolled back automatically. Backup from before the migrations: $db_backup"
    fi
    if [[ -z "$previous_build" ]]; then
      restore_data || warn "Restoring server data failed; the backup is $data_backup"
      die "Deploy of $site failed and there is no previous build to roll back to. Check the aaPanel project log."
    fi
    warn "Deploy failed; rolling back to $previous_build"
    # Rollback always uses a full sync from the previous build directory.
    use_delta=0
    need_deps=1
    if restore_data && sync_build_full "$previous_build" no yes && restart_site && site_healthy; then
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
