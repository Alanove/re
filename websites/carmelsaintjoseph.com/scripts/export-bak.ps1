# Restores the LiteWeb .bak into LocalDB, writes content/bak-export.json via SqlClient + ConvertTo-Json, drops the DB.
$ErrorActionPreference = 'Stop'
$siteRoot = Split-Path $PSScriptRoot -Parent
$bak = Join-Path $siteRoot 'wwwroot\carmelsaintjoseph.edu.lb-2019_backup_2026_11_23_000055_7392988.bak'
$dataDir = Join-Path $siteRoot 'content\sql-data'
$out = Join-Path $siteRoot 'content\bak-export.json'
$server = '(localdb)\MSSQLLocalDB'
$db = 'carmel_import'

if (-not (Test-Path $bak)) { throw "Backup not found: $bak" }
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
$mdf = Join-Path $dataDir 'carmel.mdf'
$ldf = Join-Path $dataDir 'carmel_log.ldf'

function Invoke-Sql([string]$query, [string]$database = 'master') {
  $result = & sqlcmd -S $server -E -C -d $database -Q $query 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($result | Out-String) }
  return $result
}

# Keep existing restore if still present from a failed prior run.
$exists = (& sqlcmd -S $server -E -C -Q "SET NOCOUNT ON; SELECT DB_ID(N'$db');" -h -1 -W 2>&1 | Out-String).Trim()
if ($exists -eq '' -or $exists -eq 'NULL') {
  Invoke-Sql @"
RESTORE DATABASE [$db]
FROM DISK = N'$($bak.Replace("'","''"))'
WITH MOVE N'carmel' TO N'$($mdf.Replace("'","''"))',
     MOVE N'carmel_log' TO N'$($ldf.Replace("'","''"))',
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

$albums = Get-PlainRows @"
SELECT Id, Name, DisplayName, ISNULL(CAST(Description AS nvarchar(max)), N'') AS Description,
  Status, Sort, ISNULL(Image, N'') AS Image, CategoryId,
  CONVERT(varchar(33), DateAdded, 127) AS DateAdded,
  CONVERT(varchar(33), DateModified, 127) AS DateModified,
  CONVERT(varchar(33), AlbumDate, 127) AS AlbumDate
FROM PhotoAlbums ORDER BY Id
"@

$albumImages = Get-PlainRows @"
SELECT Id, AlbumId, Sort, ISNULL(Caption, N'') AS Caption, FileName,
  CONVERT(varchar(33), DateAdded, 127) AS DateAdded
FROM PhotoAlbumImages ORDER BY AlbumId, Sort, Id
"@

$albumCategories = Get-PlainRows @"
SELECT CategoryId, CategoryName, UniqueName FROM PhotoAlbumsCategories ORDER BY CategoryId
"@

$conn.Close()

$payload = @{
  exportedAt = (Get-Date).ToUniversalTime().ToString('o')
  counts = @{
    pages = $pages.Count
    pageImages = $pageImages.Count
    albums = $albums.Count
    albumImages = $albumImages.Count
    albumCategories = $albumCategories.Count
  }
  pages = $pages
  pageImages = $pageImages
  albums = $albums
  albumImages = $albumImages
  albumCategories = $albumCategories
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
Write-Host ("counts pages={0} pageImages={1} albums={2} albumImages={3}" -f $pages.Count, $pageImages.Count, $albums.Count, $albumImages.Count)
Write-Host ("Export size: {0} bytes" -f (Get-Item $out).Length)
