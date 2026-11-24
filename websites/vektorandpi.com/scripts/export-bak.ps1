# Restores the LiteWeb .bak into LocalDB, writes content/bak-export.json via SqlClient + ConvertTo-Json, drops the DB.
$ErrorActionPreference = 'Stop'
$siteRoot = Split-Path $PSScriptRoot -Parent
$bak = Join-Path $siteRoot 'app\VektorandPi_backup_2026_11_24_000009_6305281.bak'
$dataDir = Join-Path $siteRoot 'content\sql-data'
$out = Join-Path $siteRoot 'content\bak-export.json'
$server = '(localdb)\MSSQLLocalDB'
$db = 'vektor_import'

if (-not (Test-Path $bak)) { throw "Backup not found: $bak" }
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
$mdf = Join-Path $dataDir 'vektor.mdf'
$ldf = Join-Path $dataDir 'vektor_log.ldf'

function Invoke-Sql([string]$query, [string]$database = 'master') {
  $result = & sqlcmd -S $server -E -C -d $database -Q $query 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($result | Out-String) }
  return $result
}

$fileList = & sqlcmd -S $server -E -C -Q "SET NOCOUNT ON; RESTORE FILELISTONLY FROM DISK = N'$($bak.Replace("'","''"))';" -s '|' -W 2>&1
if ($LASTEXITCODE -ne 0) { throw ($fileList | Out-String) }
$logical = @()
foreach ($line in ($fileList | Out-String) -split "`r?`n") {
  if ($line -match '^\s*$' -or $line -match '^-' -or $line -match 'LogicalName') { continue }
  $parts = $line -split '\|'
  if ($parts.Count -ge 3) {
    $name = $parts[0].Trim()
    $type = $parts[2].Trim()
    if ($name) { $logical += [pscustomobject]@{ Name = $name; Type = $type } }
  }
}
if ($logical.Count -lt 2) {
  # Fallback parse without header awareness
  $raw = & sqlcmd -S $server -E -C -Q "SET NOCOUNT ON; RESTORE FILELISTONLY FROM DISK = N'$($bak.Replace("'","''"))';" -h -1 -W 2>&1
  $logical = @()
  foreach ($line in @($raw)) {
    $cols = ($line -split '\s{2,}') | Where-Object { $_ -ne '' }
    if ($cols.Count -ge 3 -and $cols[0] -notmatch 'LogicalName') {
      $logical += [pscustomobject]@{ Name = $cols[0]; Type = $cols[2] }
    }
  }
}
$dataLogical = ($logical | Where-Object { $_.Type -eq 'D' } | Select-Object -First 1).Name
$logLogical = ($logical | Where-Object { $_.Type -eq 'L' } | Select-Object -First 1).Name
if (-not $dataLogical -or -not $logLogical) {
  throw "Could not read logical file names from bak. FILELISTONLY output:`n$($fileList | Out-String)"
}

$exists = (& sqlcmd -S $server -E -C -Q "SET NOCOUNT ON; SELECT DB_ID(N'$db');" -h -1 -W 2>&1 | Out-String).Trim()
if ($exists -eq '' -or $exists -eq 'NULL') {
  Invoke-Sql @"
RESTORE DATABASE [$db]
FROM DISK = N'$($bak.Replace("'","''"))'
WITH MOVE N'$($dataLogical.Replace("'","''"))' TO N'$($mdf.Replace("'","''"))',
     MOVE N'$($logLogical.Replace("'","''"))' TO N'$($ldf.Replace("'","''"))',
     REPLACE;
"@
}

Add-Type -AssemblyName System.Data
$cs = "Server=$server;Database=$db;Integrated Security=True;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection $cs
$conn.Open()

function Get-PlainRows([string]$query) {
  $cmd = $conn.CreateCommand()
  $cmd.CommandText = $query
  $cmd.CommandTimeout = 120
  $reader = $cmd.ExecuteReader()
  $names = @()
  for ($i = 0; $i -lt $reader.FieldCount; $i++) { $names += $reader.GetName($i) }
  $list = New-Object System.Collections.Generic.List[object]
  while ($reader.Read()) {
    $map = @{}
    for ($i = 0; $i -lt $names.Count; $i++) {
      if ($reader.IsDBNull($i)) {
        $map[$names[$i]] = $null
      } else {
        $value = $reader.GetValue($i)
        if ($value -is [datetime]) { $map[$names[$i]] = ([datetime]$value).ToUniversalTime().ToString('o') }
        elseif ($value -is [bool]) { $map[$names[$i]] = [int][bool]$value }
        elseif ($value -is [byte] -or $value -is [int16] -or $value -is [int32] -or $value -is [int64] -or $value -is [decimal] -or $value -is [double] -or $value -is [float]) {
          $map[$names[$i]] = [double]$value
        }
        else { $map[$names[$i]] = [string]$value }
      }
    }
    $list.Add($map)
  }
  $reader.Close()
  return $list
}

$pages = Get-PlainRows @"
SELECT PageId, ParentId, URL, Title, Header,
  ISNULL(CAST(SmallDescription AS nvarchar(max)), N'') AS SmallDescription,
  ISNULL(CAST(PageContent AS nvarchar(max)), N'') AS PageContent,
  Status, ISNULL(Image, N'') AS Image, Ranking, ISNULL(Keywords, N'') AS Keywords,
  ImageWidth, ImageHeight, PageType,
  CONVERT(varchar(33), DateCreated, 127) AS DateCreated,
  CONVERT(varchar(33), DateModified, 127) AS DateModified,
  CONVERT(varchar(33), PublishDate, 127) AS PublishDate
FROM Pages ORDER BY PageId
"@

$pageImages = Get-PlainRows @"
SELECT ImageId, PageId, Sort, ISNULL(Caption, N'') AS Caption, FileName, Width, Height,
  CONVERT(varchar(33), DateAdded, 127) AS DateAdded
FROM PageImages ORDER BY PageId, Sort, ImageId
"@

$conn.Close()

$payload = @{
  exportedAt = (Get-Date).ToUniversalTime().ToString('o')
  counts = @{
    pages = $pages.Count
    pageImages = $pageImages.Count
  }
  pages = $pages
  pageImages = $pageImages
  albums = @()
  albumImages = @()
  albumCategories = @()
}

New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
$json = $payload | ConvertTo-Json -Depth 8 -Compress
[System.IO.File]::WriteAllText($out, $json + "`n", [System.Text.UTF8Encoding]::new($false))

Invoke-Sql @"
ALTER DATABASE [$db] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
DROP DATABASE [$db];
"@
Remove-Item $dataDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Wrote $out"
Write-Host ("counts pages={0} pageImages={1}" -f $pages.Count, $pageImages.Count)
Write-Host ("Export size: {0} bytes" -f (Get-Item $out).Length)
