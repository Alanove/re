Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$srcRoot = 'c:\ai\tests\btb\Capital Pro Original Images-20260919T132024Z-1-001\Capital Pro Original Images'
$alain = Join-Path $srcRoot 'Alain'
$pub = 'c:\ai\tests\btb\capital-new-cms\public'
$tmp = 'c:\ai\tests\btb\capital-new-cms\tmp-client-media'

function Ensure-Dir($path) {
  New-Item -ItemType Directory -Force -Path $path | Out-Null
}

function Resize-Jpeg([string]$src, [string]$dest, [int]$maxW, [int]$quality = 80) {
  Ensure-Dir (Split-Path $dest)
  $img = [System.Drawing.Image]::FromFile($src)
  try {
    $ratio = [Math]::Min(1.0, $maxW / [double]$img.Width)
    $w = [Math]::Max(1, [int]($img.Width * $ratio))
    $h = [Math]::Max(1, [int]($img.Height * $ratio))
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    try {
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g.DrawImage($img, 0, 0, $w, $h)
      $g.Dispose()
      $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
      $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters 1
      $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]$quality)
      $bmp.Save($dest, $jpegCodec, $encoderParams)
    } finally {
      $bmp.Dispose()
    }
  } finally {
    $img.Dispose()
  }
  Write-Host ("Wrote " + $dest + " (" + [math]::Round((Get-Item $dest).Length / 1KB) + " KB)")
}

function Copy-File([string]$src, [string]$dest) {
  Ensure-Dir (Split-Path $dest)
  Copy-Item -LiteralPath $src -Destination $dest -Force
  Write-Host ("Copied " + $dest)
}

Ensure-Dir $tmp

Get-ChildItem -LiteralPath $alain -Filter *.docx | ForEach-Object {
  $name = $_.BaseName
  $extract = Join-Path $tmp $name
  if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
  $zip = Join-Path $tmp ($name + '.zip')
  Copy-Item $_.FullName $zip -Force
  Expand-Archive -LiteralPath $zip -DestinationPath $extract -Force
}

$banners = @{
  'advisory' = 'bigstock-Manager-Unlocking-A-Virtual-Lo-101788196.jpg'
  'taxes' = 'shutterstock_1912847029.jpg'
  'bookkeeping' = 'shutterstock_2018528900.jpg'
  'wealth' = 'shutterstock_720676273.jpg'
  'insure' = 'bigstock-Family-Life-Insurance-And-Poli-90647771.jpg'
  'news' = 'shutterstock_1452920096.jpg'
  'testimonials' = 'shutterstock_1612695787.jpg'
  'our-team' = 'bigstock-Leader-And-Ceo-114459344.jpg'
  'contact' = 'bigstock-Call-center-operator-woman-Ov-52674952.jpg'
}

$bodies = @{
  'advisory' = 'shutterstock_26873632.jpg'
  'taxes' = 'shutterstock_434507503.jpg'
  'bookkeeping' = 'shutterstock_1337306621.jpg'
  'wealth' = 'shutterstock_718269193.jpg'
  'insure' = 'shutterstock_29385997.jpg'
}

foreach ($k in $banners.Keys) {
  Resize-Jpeg (Join-Path $srcRoot $banners[$k]) (Join-Path $pub "uploads\pages\$k-banner.jpg") 1920 78
}
foreach ($k in $bodies.Keys) {
  Resize-Jpeg (Join-Path $srcRoot $bodies[$k]) (Join-Path $pub "uploads\pages\$k-body.jpg") 1200 78
}

Resize-Jpeg (Join-Path $srcRoot $banners['advisory']) (Join-Path $pub 'images\slides\advisory-1.jpg') 1920 78
Resize-Jpeg (Join-Path $srcRoot $banners['taxes']) (Join-Path $pub 'images\slides\taxes-4.jpg') 1920 78
Resize-Jpeg (Join-Path $srcRoot $banners['bookkeeping']) (Join-Path $pub 'images\slides\bookkeeping-3.jpg') 1920 78
Resize-Jpeg (Join-Path $srcRoot $banners['wealth']) (Join-Path $pub 'images\slides\wealth-management-1.jpg') 1920 78
Resize-Jpeg (Join-Path $srcRoot $banners['insure']) (Join-Path $pub 'images\slides\income-replacement-2.jpg') 1920 78

Resize-Jpeg (Join-Path $srcRoot 'shutterstock_292958480.jpg') (Join-Path $pub 'images\about\our-concept.jpg') 1400 78
Resize-Jpeg (Join-Path $srcRoot 'shutterstock_1563352276.jpg') (Join-Path $pub 'images\content\why-choose-fixed.jpg') 1600 78
Resize-Jpeg (Join-Path $srcRoot 'shutterstock_1361250608.jpg') (Join-Path $pub 'images\content\why-choose1.jpg') 1600 78
Resize-Jpeg (Join-Path $srcRoot 'shutterstock_530749768.jpg') (Join-Path $pub 'images\content\why-choose2.jpg') 1600 78
Resize-Jpeg (Join-Path $srcRoot 'shutterstock_30670783.jpg') (Join-Path $pub 'images\content\why-choose3.jpg') 1600 78
Resize-Jpeg (Join-Path $srcRoot $banners['testimonials']) (Join-Path $pub 'images\bg\testimonials.jpg') 1920 78

Resize-Jpeg (Join-Path $alain 'Tarek-Sayegh-Photo.JPG') (Join-Path $pub 'images\team\tarek-sayegh.jpg') 800 82
Resize-Jpeg (Join-Path $alain 'Joseph-Mansour-Photo.jpg') (Join-Path $pub 'images\team\joseph-mansour.jpg') 800 82

$logoDir = Join-Path $pub 'images\logos'
Ensure-Dir $logoDir

# Home page logo (group)
$homeLogo = Join-Path $tmp 'Home Page\word\media\image1.jpeg'
if (Test-Path $homeLogo) {
  Copy-File $homeLogo (Join-Path $logoDir 'capital-pro-group.jpg')
  Copy-File $homeLogo (Join-Path $pub 'images\capital-group-logo.png')
}

$bookLogo = Join-Path $tmp 'Companies - Bookkeeping\word\media\image1.png'
if (Test-Path $bookLogo) { Copy-File $bookLogo (Join-Path $logoDir 'bookkeeping.png') }

$insureLogo = Join-Path $tmp 'Companies - Insure\word\media\image1.png'
if (Test-Path $insureLogo) { Copy-File $insureLogo (Join-Path $logoDir 'insure.png') }

$taxesLogo = Join-Path $tmp 'Companies - Taxes\word\media\image1.png'
if (Test-Path $taxesLogo) { Copy-File $taxesLogo (Join-Path $logoDir 'taxes.png') }

$wealthDir = Join-Path $tmp 'Companies - Wealth\word\media'
if (Test-Path $wealthDir) {
  Get-ChildItem $wealthDir | ForEach-Object {
    Copy-File $_.FullName (Join-Path $logoDir ('wealth-' + $_.Name))
  }
}

$variousDir = Join-Path $tmp 'Various Logos\word\media'
if (Test-Path $variousDir) {
  Get-ChildItem $variousDir | ForEach-Object {
    Copy-File $_.FullName (Join-Path $logoDir ('various-' + $_.Name))
  }
}

Write-Host 'Asset processing complete.'
