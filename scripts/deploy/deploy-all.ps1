<#
.SYNOPSIS
  Deploys every site in websites/ that has a deploy.json, one after another, after a typed confirmation.

.DESCRIPTION
  Each site is deployed by scripts/deploy/deploy.ps1 in its own PowerShell process, exactly as a single-site
  deploy would run. A failed site does not stop the run: the remaining sites are still deployed and a summary
  lists which sites succeeded and which failed. The exit code is 1 when any site failed.

  Data overwrites (-OverwriteData, -DataFiles) and older commits (-Ref) are not available here; use deploy.ps1
  for one site when you need them.

.EXAMPLE
  .\scripts\deploy\deploy-all.ps1
  .\scripts\deploy\deploy-all.ps1 -Exclude re-petroleum.com,bypec-lb.com
  .\scripts\deploy\deploy-all.ps1 -SkipChecks
#>
[CmdletBinding()]
param(
  [string[]]$Exclude,

  [switch]$SkipChecks
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ConfirmPhrase = 'DEPLOY ALL'

function Fail([string]$Message) {
  Write-Host "ERROR: $Message" -ForegroundColor Red
  exit 1
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

function Get-OptionalProperty($Object, [string]$Name) {
  if ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name) {
    return $Object.$Name
  }
  return $null
}

function Format-Duration([TimeSpan]$Span) {
  return '{0}m {1:00}s' -f [int][Math]::Floor($Span.TotalMinutes), $Span.Seconds
}

$script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$websitesDir = Join-Path $script:RepoRoot 'websites'
$deployScript = Join-Path $PSScriptRoot 'deploy.ps1'
if (-not (Test-Path $websitesDir) -or -not (Test-Path $deployScript)) {
  Fail 'Could not find websites/ and scripts/deploy/deploy.ps1 (run this from the repository).'
}

$localJsonPath = Join-Path $PSScriptRoot 'deploy.local.json'
if (-not (Test-Path $localJsonPath)) {
  Fail "scripts/deploy/deploy.local.json is missing. Copy deploy.local.example.json and fill in the SSH details."
}
$localConfig = Get-Content -Raw $localJsonPath | ConvertFrom-Json
$branch = Get-OptionalProperty $localConfig 'branch'
if (-not $branch) { $branch = 'main' }
if ($branch -notmatch '^[A-Za-z0-9._/-]+$') { Fail 'deploy.local.json branch is not a valid branch name.' }

$allFolders = @(Get-ChildItem $websitesDir -Directory | Sort-Object Name)
$notReady = @($allFolders | Where-Object { Test-Path (Join-Path $_.FullName 'NOT_READY.md') } | ForEach-Object Name)
$deployable = @($allFolders | Where-Object { $notReady -notcontains $_.Name -and (Test-Path (Join-Path $_.FullName 'deploy.json')) -and (Test-Path (Join-Path $_.FullName 'package.json')) } | ForEach-Object Name)
$withoutDeployJson = @($allFolders | Where-Object { $notReady -notcontains $_.Name -and $deployable -notcontains $_.Name } | ForEach-Object Name)

$excluded = @($Exclude | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
foreach ($name in $excluded) {
  if ($deployable -notcontains $name) {
    Fail "-Exclude '$name' is not a deployable site. Deployable sites: $($deployable -join ', ')"
  }
}
$sites = @($deployable | Where-Object { $excluded -notcontains $_ })
if ($sites.Count -eq 0) {
  Fail 'No sites left to deploy.'
}

Step "Fetching origin/$branch"
Invoke-Git fetch --quiet origin $branch | Out-Null
$remoteSha = (Invoke-Git rev-parse "origin/$branch" | Out-String).Trim()
$headSha = (Invoke-Git rev-parse HEAD | Out-String).Trim()
if ($headSha -ne $remoteSha) {
  Fail "Local HEAD ($($headSha.Substring(0, 8))) is not origin/$branch ($($remoteSha.Substring(0, 8))). Push or pull first."
}
$pathspecs = @($sites | ForEach-Object { "websites/$_" }) + 'packages'
$dirty = Invoke-Git status --porcelain -- @pathspecs
if ($dirty) {
  Fail "Uncommitted changes in the sites being deployed or packages/. Commit and push first:`n$($dirty -join "`n")"
}

$subject = (Invoke-Git log -1 --format=%s $remoteSha | Out-String).Trim()
Write-Host ''
Write-Host "Commit:  $($remoteSha.Substring(0, 8))  $subject"
Write-Host "Checks:  $(if ($SkipChecks) { 'skipped (-SkipChecks)' } else { 'typecheck, lint and build run for each site before it is deployed' })"
Write-Host 'Data:    kept on every site (server copies of data/ and content/ are not overwritten)'
Write-Host ''
Write-Host "These $($sites.Count) sites will be deployed one after another:" -ForegroundColor Yellow
foreach ($name in $sites) {
  $deploy = Get-Content -Raw (Join-Path $websitesDir "$name/deploy.json") | ConvertFrom-Json
  Write-Host ("  {0,-28} port {1,-6} {2}" -f $name, (Get-OptionalProperty $deploy 'port'), (Get-OptionalProperty $deploy 'serverPath'))
}
if ($excluded.Count -gt 0) {
  Write-Host "Excluded: $($excluded -join ', ')"
}
if ($notReady.Count -gt 0) {
  Write-Host "Not ready (NOT_READY.md): $($notReady -join ', ')" -ForegroundColor DarkGray
}
if ($withoutDeployJson.Count -gt 0) {
  Write-Host "Not deployable (no deploy.json): $($withoutDeployJson -join ', ')" -ForegroundColor DarkGray
}
Write-Host ''
$answer = Read-Host "Type $ConfirmPhrase to continue, anything else cancels"
if ($answer.Trim() -cne $ConfirmPhrase) {
  Fail 'Cancelled. Nothing was deployed.'
}

$shell = (Get-Process -Id $PID).Path
$results = @()
$index = 0
foreach ($name in $sites) {
  $index++
  Write-Host ''
  Write-Host ("=" * 72) -ForegroundColor Magenta
  Write-Host "[$index/$($sites.Count)] $name" -ForegroundColor Magenta
  Write-Host ("=" * 72) -ForegroundColor Magenta

  $childArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $deployScript, '-Site', $name, '-Yes')
  if ($SkipChecks) { $childArgs += '-SkipChecks' }

  $started = Get-Date
  $exitCode = 1
  $note = ''
  try {
    & $shell @childArgs
    $exitCode = $LASTEXITCODE
  } catch {
    $note = $_.Exception.Message
  }
  $elapsed = (Get-Date) - $started

  $packageJson = Get-Content -Raw (Join-Path $websitesDir "$name/package.json") | ConvertFrom-Json
  $scripts = Get-OptionalProperty $packageJson 'scripts'
  if ($exitCode -eq 0 -and -not (Get-OptionalProperty $scripts 'media:check:prod')) {
    $note = 'no media:check:prod script, media check was skipped'
  }

  $results += [pscustomobject]@{
    Site     = $name
    Result   = $(if ($exitCode -eq 0) { 'OK' } else { 'FAILED' })
    Duration = Format-Duration $elapsed
    Note     = $(if ($exitCode -ne 0 -and -not $note) { "exit code $exitCode, see the output above" } else { $note })
  }
}

Write-Host ''
Write-Host 'Summary' -ForegroundColor Cyan
foreach ($row in $results) {
  $color = if ($row.Result -eq 'OK') { 'Green' } else { 'Red' }
  $line = '  {0,-28} {1,-7} {2,-9} {3}' -f $row.Site, $row.Result, $row.Duration, $row.Note
  Write-Host $line -ForegroundColor $color
}

$failed = @($results | Where-Object { $_.Result -ne 'OK' })
if ($failed.Count -gt 0) {
  Write-Host ''
  Write-Host "$($failed.Count) of $($results.Count) sites failed. Fix the cause, then redeploy only those sites, for example:" -ForegroundColor Red
  foreach ($row in $failed) {
    Write-Host "  .\scripts\deploy\deploy.ps1 -Site $($row.Site)" -ForegroundColor Red
  }
  exit 1
}
Write-Host ''
Write-Host "All $($results.Count) sites deployed at $($remoteSha.Substring(0, 8))." -ForegroundColor Green
