# Upscale missing Guerra full images from thumbs via Real-ESRGAN, encode to DB extension.
$ErrorActionPreference = 'Continue'
$Root = 'c:\ai\tests\re\tmp\guerra-upscale'
$In = Join-Path $Root 'in'
$Out = Join-Path $Root 'out'
$Work = Join-Path $Root 'work'
$Jobs = Join-Path $Root 'guerra-upscale-jobs.txt'
$Log = Join-Path $Root 'upscale.log'
$GenLog = Join-Path $Root 'generated.txt'
$SkipLog = Join-Path $Root 'skipped-local.txt'
$Exe = Join-Path $Root 'tools\realesrgan\realesrgan-ncnn-vulkan.exe'
$SharpDir = 'c:\ai\tests\re\websites\guerrasports'
$MaxEdge = 1920

New-Item -ItemType Directory -Force -Path $Out, $Work | Out-Null
'' | Set-Content -Encoding utf8 $GenLog
'' | Set-Content -Encoding utf8 $SkipLog

function Write-Log([string]$m) {
  $line = "$(Get-Date -Format o) $m"
  Add-Content -Encoding utf8 $Log $line
  Write-Host $line
}

if (-not (Test-Path $Exe)) { throw "Missing Real-ESRGAN exe: $Exe" }
if (-not (Test-Path $Jobs)) { throw "Missing jobs file: $Jobs" }

# Encoder lives inside the site package so ESM can resolve `sharp`.
$encoderJs = Join-Path $SharpDir 'scripts\_tmp_encode_upscale.mjs'
New-Item -ItemType Directory -Force -Path (Split-Path $encoderJs) | Out-Null
@'
import sharp from "sharp";
import fs from "fs";
import path from "path";

const [,, src, dest, maxEdgeStr] = process.argv;
const maxEdge = Number(maxEdgeStr || 1920);
const ext = path.extname(dest).toLowerCase();
await fs.promises.mkdir(path.dirname(dest), { recursive: true });
let img = sharp(src);
const meta = await img.metadata();
const w = meta.width || 0;
const h = meta.height || 0;
const long = Math.max(w, h);
if (long > maxEdge && long > 0) {
  img = img.resize({
    width: w >= h ? maxEdge : null,
    height: h > w ? maxEdge : null,
    fit: "inside",
    withoutEnlargement: false,
  });
}
if (ext === ".png") {
  await img.png({ compressionLevel: 9 }).toFile(dest);
} else if (ext === ".jpg" || ext === ".jpeg") {
  await img.jpeg({ quality: 90, mozjpeg: true }).toFile(dest);
} else if (ext === ".webp") {
  await img.webp({ quality: 90 }).toFile(dest);
} else {
  await img.jpeg({ quality: 90, mozjpeg: true }).toFile(dest);
}
console.log("ok", dest);
'@ | Set-Content -Encoding utf8 $encoderJs
$lines = Get-Content $Jobs | Where-Object { $_.Trim() }
$total = $lines.Count
$ok = 0
$fail = 0
$n = 0
Write-Log "start jobs=$total maxEdge=$MaxEdge"

foreach ($line in $lines) {
  $n++
  $parts = $line.Split('|')
  if ($parts.Count -lt 2) { continue }
  $destRel = $parts[0].Trim().TrimStart('/').Replace('/', '\')
  $thumbRel = $parts[1].Trim().TrimStart('/').Replace('/', '\')
  $thumbPath = Join-Path $In $thumbRel
  $outPath = Join-Path $Out $destRel
  $workPng = Join-Path $Work ("up-$n.png")

  if (-not (Test-Path -LiteralPath $thumbPath)) {
    Add-Content -Encoding utf8 $SkipLog "NO_LOCAL_THUMB $line"
    $fail++
    Write-Log "[$n/$total] skip missing thumb $thumbRel"
    continue
  }

  try {
    Remove-Item -Force -ErrorAction SilentlyContinue $workPng
    # Native stderr is GPU chatter — do not treat as terminating errors.
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    & $Exe -i $thumbPath -o $workPng -n realesrgan-x4plus -s 4 -f png -g 1 1>$null 2>$null
    $esrExit = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    if (-not (Test-Path -LiteralPath $workPng) -or ((Get-Item -LiteralPath $workPng).Length -lt 1000)) {
      throw "realesrgan failed exit=$esrExit (no/short output)"
    }
    Push-Location $SharpDir
    try {
      $encOut = & node $encoderJs $workPng $outPath $MaxEdge 2>&1
      if ($LASTEXITCODE -ne 0) { throw "encode failed: $encOut" }
    } finally {
      Pop-Location
    }
    if (-not (Test-Path -LiteralPath $outPath)) { throw "encode produced no file" }
    Add-Content -Encoding utf8 $GenLog $destRel.Replace('\', '/')
    $ok++
    Remove-Item -Force -ErrorAction SilentlyContinue $workPng
  } catch {
    $fail++
    Add-Content -Encoding utf8 $SkipLog "FAIL $line $($_.Exception.Message)"
    Write-Log "[$n/$total] FAIL $destRel $($_.Exception.Message)"
    Remove-Item -Force -ErrorAction SilentlyContinue $workPng
  }

  if ($n % 5 -eq 0 -or $n -eq $total) {
    Write-Log "progress n=$n/$total ok=$ok fail=$fail"
  }
}

Write-Log "Done. ok=$ok fail=$fail out=$Out"
