<#
.SYNOPSIS
  Uploads local JSON data for one site onto the Ubuntu/aaPanel server.
  Does not deploy code. By default pushes data/ and content/, omitting
  users.json and submissions.json. Use -DataFiles for specific paths.

.EXAMPLE
  .\scripts\deploy\push-data.ps1 -Site solutec-lb.com
  .\scripts\deploy\push-data.ps1 -Site solutec-lb.com -DataFiles pages.json,products.json,news.json
  .\scripts\deploy\push-data.ps1 -Site solutec-lb.com -DataFiles data/menu.json,content/seed.json
  .\scripts\deploy\push-data.ps1 -Site solutec-lb.com -IncludePrivate -Yes
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Site,

  [string[]]$DataFiles,

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
  Fail "'$Site' is not a site folder name. Pushes take exactly one folder from websites/, for example: -Site solutec-lb.com"
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

$privateNames = @('users.json', 'submissions.json')
$relativeFiles = [System.Collections.Generic.List[string]]::new()

if ($DataFiles -and $DataFiles.Count -gt 0) {
  foreach ($file in ($DataFiles | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })) {
    $relative = ($file -replace '\\', '/').Trim('/')
    if ($relative -notmatch '/') { $relative = "data/$relative" }
    if ($relative -notmatch '^(data|content)/[A-Za-z0-9._/-]+$' -or $relative -match '\.\.') {
      Fail "-DataFiles entry '$file' must be a file inside data/ or content/, for example pages.json or content/seed.json."
    }
    $leaf = Split-Path $relative -Leaf
    if (-not $IncludePrivate -and $privateNames -contains $leaf) {
      Fail "$relative is private. Pass -IncludePrivate to upload users.json or submissions.json."
    }
    $localPath = Join-Path $siteDir ($relative -replace '/', [IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path -LiteralPath $localPath -PathType Leaf)) {
      Fail "Local file websites/$Site/$relative does not exist."
    }
    if (-not ($relativeFiles -contains $relative)) {
      $relativeFiles.Add($relative)
    }
  }
} else {
  $sitePrefix = (Resolve-Path -LiteralPath $siteDir).Path.TrimEnd('\', '/')
  foreach ($dirName in @('data', 'content')) {
    $dirPath = Join-Path $siteDir $dirName
    if (-not (Test-Path -LiteralPath $dirPath -PathType Container)) { continue }
    Get-ChildItem -LiteralPath $dirPath -File -Recurse | ForEach-Object {
      $full = $_.FullName
      if (-not $full.StartsWith($sitePrefix, [System.StringComparison]::OrdinalIgnoreCase)) { return }
      $rel = $full.Substring($sitePrefix.Length).TrimStart('\', '/').Replace('\', '/')
      $leaf = Split-Path $rel -Leaf
      if ($leaf -like '*.bak') { return }
      if (-not $IncludePrivate -and $privateNames -contains $leaf) { return }
      if ($rel -notmatch '^(data|content)/') { return }
      $relativeFiles.Add($rel)
    }
  }
}

if ($relativeFiles.Count -eq 0) {
  Fail "No local data/ or content/ files to push for websites/$Site."
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
  $localScript = Join-Path $env:TEMP "push-data-$stamp.sh"
  $remoteScript = "/tmp/push-data-$stamp.sh"
  [System.IO.File]::WriteAllText($localScript, $normalized, (New-Object System.Text.UTF8Encoding $false))

  try {
    $ErrorActionPreference = 'Continue'
    & scp @scpBase $localScript "${sshTarget}:$remoteScript"
    if ($LASTEXITCODE -ne 0) {
      Fail "scp of helper script to $remoteScript failed."
    }

    $quoted = (@($BashArgs) | ForEach-Object { "'$_'" }) -join ' '
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

Write-Host ''
Write-Host "Site:    $Site"
Write-Host "Server:  $sshUser@${sshHost}:$serverPath (writes as $runAs)"
if ($DataFiles -and $DataFiles.Count -gt 0) {
  Write-Host "Mode:    specific files ($($relativeFiles.Count))" -ForegroundColor Yellow
} else {
  Write-Host "Mode:    all local data/ and content/ JSON (except private and *.bak)"
}
if ($IncludePrivate) {
  Write-Host 'Private: including users.json / submissions.json when selected' -ForegroundColor Yellow
} else {
  Write-Host 'Private: omitting users.json and submissions.json (pass -IncludePrivate to upload them)'
}
Write-Host 'Files:'
foreach ($rel in ($relativeFiles | Sort-Object)) {
  $localPath = Join-Path $siteDir ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
  $size = (Get-Item -LiteralPath $localPath).Length
  Write-Host ("  {0,-40} {1,10:N0} bytes" -f $rel, $size)
}
Write-Host ''
Write-Host 'The server copy of data/ and content/ is backed up first under /www/deploy/state/<site>/data-backups/.' -ForegroundColor Yellow
Write-Host 'Media (uploads, images, pages, protect paths) is not uploaded by this script.' -ForegroundColor DarkGray
Write-Host ''

if (-not $Yes) {
  if (-not (Confirm-YesNo "Overwrite these live files on $Site now?")) {
    Fail 'Cancelled.'
  }
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$localTar = Join-Path $env:TEMP "push-data-$Site-$stamp.tar.gz"
$remoteTar = "/tmp/push-data-$Site-$stamp.tar.gz"

Step "Packing local files"
Push-Location $siteDir
try {
  $ErrorActionPreference = 'Continue'
  # Windows tar accepts forward-slash members when given relative paths.
  & tar -czf $localTar -- @($relativeFiles)
  if ($LASTEXITCODE -ne 0) {
    Fail "tar pack failed for websites/$Site"
  }
  $ErrorActionPreference = 'Stop'
} finally {
  Pop-Location
}

Step "Copying archive to server"
$ErrorActionPreference = 'Continue'
& scp @scpBase $localTar "${sshTarget}:$remoteTar"
$scpCode = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
Remove-Item -Force -ErrorAction SilentlyContinue $localTar
if ($scpCode -ne 0) {
  Fail "scp of archive to $remoteTar failed."
}

# scp lands the archive as the SSH user; www needs to read it for extract.
Step "Allowing $runAs to read the archive"
$ErrorActionPreference = 'Continue'
& ssh @($sshBase + @($sshTarget, "chmod a+r '$remoteTar'"))
if ($LASTEXITCODE -ne 0) {
  Fail "Could not chmod $remoteTar for $runAs to read."
}
$ErrorActionPreference = 'Stop'

$applyScript = @'
set -euo pipefail
cd /
server_path="$1"
remote_tar="$2"
site="$3"
state_dir="/www/deploy/state/$site"
mkdir -p "$state_dir/data-backups"
backup=""
dirs=()
[[ -d "$server_path/data" ]] && dirs+=(data)
[[ -d "$server_path/content" ]] && dirs+=(content)
if ((${#dirs[@]} > 0)); then
  backup="$state_dir/data-backups/push-data-$(date +%Y%m%d-%H%M%S).tar.gz"
  tar -czf "$backup" -C "$server_path" "${dirs[@]}"
  chmod 600 "$backup"
  echo "BACKUP=$backup"
fi
tar -xzf "$remote_tar" -C "$server_path"
rm -f "$remote_tar"
echo "APPLIED=$server_path"
'@

Step "Backing up server data and applying upload"
$applyOut = Invoke-RemoteBash $applyScript @($serverPath, $remoteTar, $Site)
foreach ($line in $applyOut) {
  if ($line -is [string] -and ($line.StartsWith('BACKUP=') -or $line.StartsWith('APPLIED='))) {
    Write-Host $line
  }
}

Write-Host ''
Write-Host "Pushed $($relativeFiles.Count) file(s) to $Site." -ForegroundColor Green
Write-Host 'Restart the aaPanel Node project if the site caches JSON in memory.'
