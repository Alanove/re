<#
.SYNOPSIS
  Downloads live data and media for one site from the Ubuntu/aaPanel server
  into websites/<domain>/ on this laptop.

.EXAMPLE
  .\scripts\deploy\pull-data.ps1 -Site solutec-lb.com
  .\scripts\deploy\pull-data.ps1 -Site solutec-lb.com -Yes
  .\scripts\deploy\pull-data.ps1 -Site solutec-lb.com -IncludePrivate
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Site,

  [switch]$IncludePrivate,

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
  Fail "'$Site' is not a site folder name. Pulls take exactly one folder from websites/, for example: -Site solutec-lb.com"
}
$siteDir = Join-Path $script:RepoRoot "websites/$Site"
if (-not (Test-Path (Join-Path $siteDir 'package.json'))) {
  $known = (Get-ChildItem (Join-Path $script:RepoRoot 'websites') -Directory | ForEach-Object Name) -join ', '
  Fail "No site folder websites/$Site. Known sites: $known"
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
$protect = @(Get-OptionalProperty $deploy 'protect' | Where-Object { $_ })
foreach ($item in $protect) {
  if ($item -notmatch '^[A-Za-z0-9._-][A-Za-z0-9._/-]*$' -or $item -match '\.\.') {
    Fail "deploy.json protect entry '$item' must be a relative path inside the site folder."
  }
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

$baseDirs = @('data', 'content', 'public/uploads', 'public/images', 'public/pages')
$pullDirs = [System.Collections.Generic.List[string]]::new()
foreach ($dir in $baseDirs) { $pullDirs.Add($dir) }
foreach ($item in $protect) {
  $normalized = ($item -replace '\\', '/').Trim('/')
  if ($normalized -eq 'data-backups') { continue }
  if (-not ($pullDirs -contains $normalized)) {
    $pullDirs.Add($normalized)
  }
}

$sshBase = @('-T', '-o', 'BatchMode=yes', '-p', "$sshPort")
$scpBase = @('-o', 'BatchMode=yes', '-P', "$sshPort")
if ($identityFile) {
  $expandedIdentity = [Environment]::ExpandEnvironmentVariables([string]$identityFile)
  $sshBase += @('-i', $expandedIdentity)
  $scpBase += @('-i', $expandedIdentity)
}
$sshTarget = "$sshUser@$sshHost"

function Invoke-RemoteBash([string]$ScriptText, [string[]]$BashArgs) {
  $normalized = ($ScriptText -replace "`r`n", "`n" -replace "`r", "`n")
  if ($normalized.Length -gt 0 -and [int][char]$normalized[0] -eq 0xFEFF) {
    $normalized = $normalized.Substring(1)
  }
  if (-not $normalized.EndsWith("`n")) { $normalized += "`n" }

  $stamp = [guid]::NewGuid().ToString('N')
  $localScript = Join-Path $env:TEMP "pull-data-$stamp.sh"
  $remoteScript = "/tmp/pull-data-$stamp.sh"
  [System.IO.File]::WriteAllText($localScript, $normalized, (New-Object System.Text.UTF8Encoding $false))

  try {
    $ErrorActionPreference = 'Continue'
    & scp @scpBase $localScript "${sshTarget}:$remoteScript"
    if ($LASTEXITCODE -ne 0) {
      Fail "scp of helper script to $remoteScript failed."
    }

    $quoted = (@($BashArgs) | ForEach-Object { "'$_'" }) -join ' '
    # Redirect the script on the remote side into bash -s (same pattern as deploy.ps1).
    if ($sshUser -eq $runAs) {
      $remoteCommand = "bash -s -- $quoted < $remoteScript; ec=`$?; rm -f $remoteScript; exit `$ec"
    } else {
      $remoteCommand = "sudo -n -u $runAs -H bash -s -- $quoted < $remoteScript; ec=`$?; rm -f $remoteScript; exit `$ec"
    }
    $sshArgs = $sshBase + @($sshTarget, $remoteCommand)
    $output = & ssh @sshArgs 2>&1 | ForEach-Object { "$_" }
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
  } finally {
    Remove-Item -LiteralPath $localScript -Force -ErrorAction SilentlyContinue
  }

  if ($code -ne 0) {
    Fail "Remote command failed (exit $code):`n$($output -join "`n")"
  }
  return @($output)
}

$probeScript = @'
set -euo pipefail
cd /
server_path="$1"
shift
if [[ ! -d "$server_path" ]]; then
  echo "MISSING_SITE:$server_path" >&2
  exit 2
fi
for d in "$@"; do
  if [[ -d "$server_path/$d" ]]; then
    size="$(du -sh "$server_path/$d" 2>/dev/null | cut -f1)"
    files="$(find "$server_path/$d" -type f 2>/dev/null | wc -l | tr -d ' ')"
    printf 'PRESENT\t%s\t%s\t%s\n' "$d" "$size" "$files"
  else
    printf 'ABSENT\t%s\t-\t0\n' "$d"
  fi
done
'@

Step "Checking remote paths on $sshHost"
$probeArgs = @($serverPath) + @($pullDirs)
$probeOut = Invoke-RemoteBash $probeScript $probeArgs
$present = [System.Collections.Generic.List[string]]::new()
Write-Host ''
Write-Host "Site:    $Site"
Write-Host "Server:  $sshUser@${sshHost}:$serverPath (reads as $runAs)"
Write-Host 'Paths:'
foreach ($line in $probeOut) {
  if ($line -isnot [string]) { continue }
  if ($line -notmatch '^(PRESENT|ABSENT)\t') { continue }
  $parts = $line -split "`t"
  $state = $parts[0]
  $dir = $parts[1]
  if ($state -eq 'PRESENT') {
    $present.Add($dir)
    Write-Host ("  {0,-22} {1,8}  {2} files" -f $dir, $parts[2], $parts[3])
  } else {
    Write-Host ("  {0,-22} (missing on server, skipped)" -f $dir) -ForegroundColor DarkGray
  }
}
if ($IncludePrivate) {
  Write-Host 'Private: including data/users.json and data/submissions.json when present' -ForegroundColor Yellow
} else {
  Write-Host 'Private: omitting data/users.json and data/submissions.json (pass -IncludePrivate to keep them)'
}
Write-Host ''

if ($present.Count -eq 0) {
  Fail "No pullable directories exist under $serverPath."
}

if (-not $Yes) {
  if (-not (Confirm-YesNo "Download these paths into websites/$Site now?")) {
    Fail 'Cancelled.'
  }
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$remoteTar = "/tmp/pull-data-$Site-$stamp.tar.gz"
$localTar = Join-Path $env:TEMP "pull-data-$Site-$stamp.tar.gz"
$includePrivateFlag = if ($IncludePrivate) { 'yes' } else { 'no' }

$packScript = @'
set -euo pipefail
cd /
server_path="$1"
remote_tar="$2"
include_private="$3"
shift 3
cd "$server_path"
excludes=()
if [[ "$include_private" != "yes" ]]; then
  [[ -f data/users.json ]] && excludes+=(--exclude=data/users.json)
  [[ -f data/submissions.json ]] && excludes+=(--exclude=data/submissions.json)
fi
tar -czf "$remote_tar" "${excludes[@]}" "$@"
ls -lh "$remote_tar" | awk '{print $5}'
'@

Step "Packing remote paths"
$packOut = Invoke-RemoteBash $packScript (@($serverPath, $remoteTar, $includePrivateFlag) + @($present))
$sizeHint = ($packOut | Select-Object -Last 1)
Write-Host "Archive size: $sizeHint"

Step "Copying archive to laptop"
$ErrorActionPreference = 'Continue'
& scp @scpBase "${sshTarget}:$remoteTar" $localTar
$scpCode = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($scpCode -ne 0) {
  Invoke-RemoteBash @'
set -euo pipefail
rm -f "$1"
'@ @($remoteTar) | Out-Null
  Fail "scp of $remoteTar failed."
}

Step "Cleaning remote archive"
Invoke-RemoteBash @'
set -euo pipefail
rm -f "$1"
'@ @($remoteTar) | Out-Null

Step "Extracting into websites/$Site"
if (-not (Test-Path $localTar)) {
  Fail "Local archive missing: $localTar"
}
Push-Location $siteDir
try {
  $ErrorActionPreference = 'Continue'
  & tar -xzf $localTar
  if ($LASTEXITCODE -ne 0) {
    Fail "tar extract failed for $localTar"
  }
  $ErrorActionPreference = 'Stop'
} finally {
  Pop-Location
  Remove-Item -Force -ErrorAction SilentlyContinue $localTar
}

Write-Host ''
Write-Host "Pulled live data for $Site into websites/$Site." -ForegroundColor Green
if (-not $IncludePrivate) {
  Write-Host 'data/users.json and data/submissions.json were not downloaded.' -ForegroundColor Yellow
}
Write-Host 'Nothing was committed. Review the changes, then commit what you need.'
