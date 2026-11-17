# Scrape Cloudflare HITs from this PC into local staging (Lebanon / local colo).
# Only saves HIT/STALE/UPDATING + HTTP 200. Does not touch the live server.
$ErrorActionPreference = 'Continue'
$Base = 'https://guerrasports.com'
$Root = 'c:\ai\tests\re\tmp'
$Missing = Join-Path $Root 'guerra-cdn-missing.txt'
$Staging = Join-Path $Root 'guerra-cdn-restore'
$HitLog = Join-Path $Root 'guerra-cdn-hits-lb.txt'
$MissLog = Join-Path $Root 'guerra-cdn-misses-lb.txt'
$Log = Join-Path $Root 'guerra-cdn-scrape-lb.log'

New-Item -ItemType Directory -Force -Path $Staging | Out-Null
'' | Set-Content -Encoding utf8 $HitLog
'' | Set-Content -Encoding utf8 $MissLog

$urls = Get-Content $Missing | Where-Object { $_ -and $_.Trim() }
$total = $urls.Count
$hits = 0
$misses = 0
$errors = 0
$n = 0

function Write-Log([string]$msg) {
  $line = "$(Get-Date -Format o) $msg"
  Add-Content -Encoding utf8 $Log $line
  Write-Host $line
}

Write-Log "CDN scrape (Lebanon PC) start total=$total staging=$Staging"

foreach ($rel in $urls) {
  $rel = $rel.Trim().TrimStart('/')
  $n++
  $dest = Join-Path $Staging ($rel -replace '/', '\')
  if (Test-Path -LiteralPath $dest) { continue }

  $hdrFile = [System.IO.Path]::GetTempFileName()
  $bodyFile = [System.IO.Path]::GetTempFileName()
  try {
    $code = & curl.exe -sS -L --max-time 45 -D $hdrFile -o $bodyFile -w '%{http_code}' "$Base/$rel" 2>$null
    if (-not $code) { $code = '000' }
    $hdr = Get-Content -Raw $hdrFile
    $status = $null
    foreach ($m in [regex]::Matches($hdr, '(?im)^cf-cache-status:\s*(\S+)')) {
      $status = $m.Groups[1].Value.ToUpperInvariant()
    }
    $ray = $null
    foreach ($m in [regex]::Matches($hdr, '(?im)^cf-ray:\s*(\S+)')) {
      $ray = $m.Groups[1].Value
    }

    $okStatus = $status -in @('HIT', 'STALE', 'UPDATING')
    if ($code -eq '200' -and $okStatus) {
      $dir = Split-Path -Parent $dest
      New-Item -ItemType Directory -Force -Path $dir | Out-Null
      Move-Item -Force -LiteralPath $bodyFile -Destination $dest
      Add-Content -Encoding utf8 $HitLog "$status $rel ray=$ray"
      $hits++
    } else {
      Remove-Item -Force -ErrorAction SilentlyContinue $bodyFile
      $st = if ($status) { $status } else { 'NONE' }
      Add-Content -Encoding utf8 $MissLog "$code $st $rel ray=$ray"
      if ($code -eq '000') { $errors++ } else { $misses++ }
    }
  } catch {
    Remove-Item -Force -ErrorAction SilentlyContinue $bodyFile
    Add-Content -Encoding utf8 $MissLog "000 ERROR $rel $($_.Exception.Message)"
    $errors++
  } finally {
    Remove-Item -Force -ErrorAction SilentlyContinue $hdrFile
  }

  if ($n % 25 -eq 0) {
    Write-Log "progress n=$n/$total hits=$hits misses=$misses errors=$errors"
  }
  Start-Sleep -Milliseconds 40
}

$staged = @(Get-ChildItem -Recurse -File $Staging -ErrorAction SilentlyContinue).Count
Write-Log "Done. hits=$hits misses=$misses errors=$errors staged_files=$staged"
Write-Log "HIT log: $HitLog"
