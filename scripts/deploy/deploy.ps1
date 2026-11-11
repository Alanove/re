<#
.SYNOPSIS
  Deploys exactly one site from websites/<domain> to the Ubuntu/aaPanel server.

.EXAMPLE
  .\scripts\deploy\deploy.ps1 -Site thronetrading.com
  .\scripts\deploy\deploy.ps1 -Site thronetrading.com -Ref 1a2b3c4d
  .\scripts\deploy\deploy.ps1 -Site thronetrading.com -OverwriteData
  .\scripts\deploy\deploy.ps1 -Site thronetrading.com -DataFiles settings.json,menus.json
  .\scripts\deploy\deploy.ps1 -Site santamariabouar.com -ForceMigrations
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Site,

  [string]$Ref,

  [switch]$OverwriteData,

  [string[]]$DataFiles,

  [switch]$SkipChecks,

  [switch]$ForceMigrations,

  [switch]$Yes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Fail([string]$Message) {
  Write-Host "ERROR: $Message" -ForegroundColor Red
  exit 1
}

function Confirm-YesNo([string]$Question) {
  while ($true) {
    $answer = (Read-Host "$Question [y/n]").Trim().ToLowerInvariant()
    if ($answer -in @('y', 'yes')) { return $true }
    if ($answer -in @('n', 'no')) { return $false }
    Write-Host 'Please answer y or n.' -ForegroundColor Yellow
  }
}

function Step([string]$Message) {
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-Git {
  $ErrorActionPreference = 'Continue'
  $output = & git -C $script:RepoRoot @args 2>&1 | ForEach-Object { "$_" }
  if ($LASTEXITCODE -ne 0) {
    Fail "git $($args -join ' ') failed:`n$($output -join "`n")"
  }
  return $output
}

function Test-Git {
  $ErrorActionPreference = 'Continue'
  & git -C $script:RepoRoot @args 2>&1 | Out-Null
  return ($LASTEXITCODE -eq 0)
}

function Get-OptionalProperty($Object, [string]$Name) {
  if ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name) {
    return $Object.$Name
  }
  return $null
}

$script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not (Test-Path (Join-Path $script:RepoRoot 'websites'))) {
  Fail 'Could not find the repository root (expected scripts/deploy inside it).'
}

if ($Site -notmatch '^[a-z0-9][a-z0-9._-]*$' -or $Site -match '\.\.') {
  Fail "'$Site' is not a site folder name. Deploys take exactly one folder from websites/, for example: -Site thronetrading.com"
}
$siteDir = Join-Path $script:RepoRoot "websites/$Site"
if (-not (Test-Path (Join-Path $siteDir 'package.json'))) {
  $known = (Get-ChildItem (Join-Path $script:RepoRoot 'websites') -Directory | ForEach-Object Name) -join ', '
  Fail "No site folder websites/$Site. Known sites: $known"
}
if (Test-Path (Join-Path $siteDir 'NOT_READY.md')) {
  Fail "websites/$Site is marked not ready (see websites/$Site/NOT_READY.md). Delete the file once the site is fixed."
}

$deployJsonPath = Join-Path $siteDir 'deploy.json'
if (-not (Test-Path $deployJsonPath)) {
  Fail "websites/$Site/deploy.json is missing. See docs/deployment.md."
}
$deploy = Get-Content -Raw $deployJsonPath | ConvertFrom-Json

$serverPath = [string](Get-OptionalProperty $deploy 'serverPath')
if ($serverPath -notmatch '^/[A-Za-z0-9._/-]+$' -or $serverPath -match '\.\.' -or $serverPath -eq '/') {
  Fail "deploy.json serverPath must be an absolute Linux path such as /www/wwwroot/$Site"
}
$port = Get-OptionalProperty $deploy 'port'
if ($null -eq $port) {
  Fail "deploy.json port is not set yet for $Site. Set it to the port of the site's aaPanel Node project."
}
if ("$port" -notmatch '^\d+$' -or [int]$port -lt 1 -or [int]$port -gt 65535) {
  Fail 'deploy.json port must be a number between 1 and 65535.'
}
$healthPath = Get-OptionalProperty $deploy 'healthPath'
if (-not $healthPath) { $healthPath = '/' }
if ($healthPath -notmatch '^/[A-Za-z0-9._/?=&-]*$') {
  Fail 'deploy.json healthPath must start with / and contain only URL-safe characters.'
}
$nodeBin = Get-OptionalProperty $deploy 'nodeBin'
if ($nodeBin -and $nodeBin -notmatch '^/[A-Za-z0-9._/-]+$') {
  Fail 'deploy.json nodeBin must be an absolute Linux path or null.'
}
$project = Get-OptionalProperty $deploy 'aapanelProject'
if ($project -and $project -notmatch '^[A-Za-z0-9._-]+$') {
  Fail 'deploy.json aapanelProject may only contain letters, digits, dot, dash and underscore.'
}
$restartCommand = Get-OptionalProperty $deploy 'restartCommand'
$protect = @(Get-OptionalProperty $deploy 'protect' | Where-Object { $_ })
foreach ($item in $protect) {
  if ($item -notmatch '^[A-Za-z0-9._-][A-Za-z0-9._/-]*$' -or $item -match '\.\.') {
    Fail "deploy.json protect entry '$item' must be a relative path inside the site folder."
  }
}
$migrations = Get-OptionalProperty $deploy 'migrations'
$migrationsDir = $null
$migrationsScript = $null
if ($null -ne $migrations) {
  $migrationsDir = [string](Get-OptionalProperty $migrations 'dir')
  $migrationsScript = [string](Get-OptionalProperty $migrations 'script')
  if ($migrationsDir -notmatch '^[A-Za-z0-9._-][A-Za-z0-9._/-]*$' -or $migrationsDir -match '\.\.') {
    Fail 'deploy.json migrations.dir must be a relative folder inside the site, for example data-migration.'
  }
  if (-not (Test-Path (Join-Path $siteDir $migrationsDir) -PathType Container)) {
    Fail "deploy.json migrations.dir '$migrationsDir' does not exist in websites/$Site."
  }
  if ($migrationsScript -notmatch '^[A-Za-z0-9][A-Za-z0-9:._-]*$') {
    Fail 'deploy.json migrations.script must be an npm script name, for example migrate:production.'
  }
  $siteScripts = (Get-Content -Raw (Join-Path $siteDir 'package.json') | ConvertFrom-Json).scripts
  if ($null -eq $siteScripts -or $siteScripts.PSObject.Properties.Name -notcontains $migrationsScript) {
    Fail "deploy.json migrations.script '$migrationsScript' is not a script in websites/$Site/package.json."
  }
} elseif ($ForceMigrations) {
  Fail "-ForceMigrations was given but websites/$Site/deploy.json has no migrations setting."
}

$localJsonPath = Join-Path $PSScriptRoot 'deploy.local.json'
if (-not (Test-Path $localJsonPath)) {
  Fail "scripts/deploy/deploy.local.json is missing. Copy deploy.local.example.json and fill in the SSH details."
}
$localConfig = Get-Content -Raw $localJsonPath | ConvertFrom-Json
$sshHost = [string](Get-OptionalProperty $localConfig 'host')
$sshUser = [string](Get-OptionalProperty $localConfig 'user')
if ($sshHost -notmatch '^[A-Za-z0-9.-]+$' -or $sshUser -notmatch '^[a-z_][a-z0-9_-]*$') {
  Fail 'deploy.local.json needs a valid host and user.'
}
$sshPort = Get-OptionalProperty $localConfig 'port'
if (-not $sshPort) { $sshPort = 22 }
$identityFile = Get-OptionalProperty $localConfig 'identityFile'
$runAs = Get-OptionalProperty $localConfig 'runAs'
if (-not $runAs) { $runAs = 'www' }
if ($runAs -notmatch '^[a-z_][a-z0-9_-]*$') { Fail 'deploy.local.json runAs is not a valid Linux user name.' }
$branch = Get-OptionalProperty $localConfig 'branch'
if (-not $branch) { $branch = 'main' }
if ($branch -notmatch '^[A-Za-z0-9._/-]+$') { Fail 'deploy.local.json branch is not a valid branch name.' }
$repoUrl = Get-OptionalProperty $localConfig 'repoUrl'
if (-not $repoUrl) {
  $origin = (Invoke-Git remote get-url origin | Out-String).Trim()
  if ($origin -match '^https://github\.com/([^/]+)/(.+?)(\.git)?$') {
    $repoUrl = "git@github.com:$($Matches[1])/$($Matches[2]).git"
  } else {
    $repoUrl = $origin
  }
}
if ($repoUrl -notmatch '^[A-Za-z0-9@:/._~-]+$') { Fail "Unsupported repoUrl: $repoUrl" }

Step "Fetching origin/$branch"
Invoke-Git fetch --quiet origin $branch | Out-Null
$remoteSha = (Invoke-Git rev-parse "origin/$branch" | Out-String).Trim()

if ($Ref) {
  $sha = (Invoke-Git rev-parse --verify "$Ref^{commit}" | Out-String).Trim()
  if (-not (Test-Git merge-base --is-ancestor $sha $remoteSha)) {
    Fail "Commit $Ref is not on origin/$branch. Only pushed commits can be deployed."
  }
} else {
  $dirty = Invoke-Git status --porcelain -- "websites/$Site" packages
  if ($dirty) {
    Fail "Uncommitted changes in websites/$Site or packages/. Commit and push first:`n$($dirty -join "`n")"
  }
  $headSha = (Invoke-Git rev-parse HEAD | Out-String).Trim()
  if ($headSha -ne $remoteSha) {
    Fail "Local HEAD ($($headSha.Substring(0, 8))) is not origin/$branch ($($remoteSha.Substring(0, 8))). Push or pull first, or pass -Ref."
  }
  $sha = $remoteSha
}

if (-not (Test-Git cat-file -e "${sha}:websites/$Site/.env.production")) {
  Fail "websites/$Site/.env.production is not committed at $($sha.Substring(0, 8)). It becomes the server .env."
}
$prodEnv = Invoke-Git show "${sha}:websites/$Site/.env.production"
$envPortLine = $prodEnv | Where-Object { $_ -match '^\s*PORT\s*=' } | Select-Object -First 1
if ($envPortLine) {
  $envPort = ($envPortLine -replace '^\s*PORT\s*=\s*', '').Trim().Trim('"', "'")
  if ($envPort -ne "$port") {
    Fail ".env.production sets PORT=$envPort but deploy.json port is $port. Make them match."
  }
}
$envNode = $prodEnv | Where-Object { $_ -match '^\s*NODE_ENV\s*=' } | Select-Object -First 1
if (-not $envNode -or $envNode -notmatch 'production') {
  Fail '.env.production must set NODE_ENV=production.'
}

$overwriteSpec = '-'
$overwriteText = 'kept (server copies of data/ and content/ are not overwritten)'
if ($DataFiles) {
  $normalized = @()
  foreach ($file in ($DataFiles | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })) {
    $relative = $file -replace '\\', '/'
    if ($relative -notmatch '/') { $relative = "data/$relative" }
    if ($relative -notmatch '^(data|content)/[A-Za-z0-9._/-]+$' -or $relative -match '\.\.') {
      Fail "-DataFiles entry '$file' must be a file inside data/ or content/, for example settings.json or content/seed.json."
    }
    if (-not (Test-Git cat-file -e "${sha}:websites/$Site/$relative")) {
      Fail "$relative is not in commit $($sha.Substring(0, 8)), so it cannot overwrite the server copy."
    }
    $normalized += $relative
  }
  $overwriteSpec = ($normalized | Select-Object -Unique) -join ':'
  $overwriteText = "OVERWRITE $($overwriteSpec -replace ':', ', ') with the committed version"
} elseif ($OverwriteData) {
  $overwriteSpec = 'all'
  $overwriteText = 'OVERWRITE every committed file in data/ and content/ (users.json, submissions.json and uploads are untouched)'
}

if ($Ref) {
  Write-Host 'Local build checks skipped: -Ref deploys a commit that is not checked out here.' -ForegroundColor Yellow
} elseif ($SkipChecks) {
  Write-Host 'Local build checks skipped (-SkipChecks).' -ForegroundColor Yellow
} else {
  Push-Location $siteDir
  try {
    foreach ($gate in 'typecheck', 'lint', 'build') {
      Step "npm run $gate"
      & npm run $gate
      if ($LASTEXITCODE -ne 0) { Fail "npm run $gate failed. Nothing was deployed." }
    }
  } finally {
    Pop-Location
  }
}

$subject = (Invoke-Git log -1 --format=%s $sha | Out-String).Trim()
Write-Host ''
Write-Host "Site:    $Site"
Write-Host "Commit:  $($sha.Substring(0, 8))  $subject"
Write-Host "Server:  $sshUser@${sshHost}:$serverPath (runs as $runAs)"
if ($overwriteSpec -eq '-') {
  Write-Host "Data:    $overwriteText"
} else {
  Write-Host "Data:    $overwriteText" -ForegroundColor Yellow
  Write-Host '         The server copy is backed up first and restored if the deploy fails.' -ForegroundColor Yellow
}
if (-not $migrationsScript) {
  Write-Host 'Migrations: none'
} elseif ($ForceMigrations) {
  Write-Host "Migrations: FORCED (database backup, then npm run $migrationsScript)" -ForegroundColor Yellow
} else {
  Write-Host "Migrations: run if $migrationsDir changed since the last deploy (database backup, then npm run $migrationsScript)"
}
Write-Host ''
if (-not $Yes) {
  if (-not (Confirm-YesNo "Deploy $Site now?")) { Fail 'Cancelled.' }
  if ($overwriteSpec -ne '-') {
    if (-not (Confirm-YesNo 'Live edits made in the admin panel to these files will be lost. Overwrite them?')) { Fail 'Cancelled.' }
  }
}

$remoteArgs = @(
  $Site, $sha, $serverPath, "$port", $healthPath,
  $(if ($nodeBin) { $nodeBin } else { '-' }),
  $(if ($project) { $project } else { '-' }),
  $(if ($restartCommand) { [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string]$restartCommand)) } else { '-' }),
  $(if ($protect.Count -gt 0) { $protect -join ':' } else { '-' }),
  $repoUrl,
  $overwriteSpec,
  $(if ($migrationsDir) { $migrationsDir } else { '-' }),
  $(if ($migrationsScript) { $migrationsScript } else { '-' }),
  $(if ($ForceMigrations) { 'force' } else { 'auto' })
)
$quoted = ($remoteArgs | ForEach-Object { "'$_'" }) -join ' '
if ($sshUser -eq $runAs) {
  $remoteCommand = "bash -s -- $quoted"
} else {
  $remoteCommand = "sudo -n -u $runAs -H bash -s -- $quoted"
}

$sshArgs = @('-T', '-o', 'BatchMode=yes', '-p', "$sshPort")
if ($identityFile) { $sshArgs += @('-i', [Environment]::ExpandEnvironmentVariables([string]$identityFile)) }
$sshArgs += @("$sshUser@$sshHost", $remoteCommand)

$scriptText = (Get-Content -Raw (Join-Path $PSScriptRoot 'deploy-site.sh')) -replace "`r`n", "`n"
$OutputEncoding = New-Object System.Text.UTF8Encoding $false

Step "Deploying $Site to $sshHost"
$scriptText | & ssh @sshArgs
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
  Fail "Deploy of $Site failed (exit code $exitCode). See the output above."
}
Write-Host "Deployed $Site at $($sha.Substring(0, 8))." -ForegroundColor Green
