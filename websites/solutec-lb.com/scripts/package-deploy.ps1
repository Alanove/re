# Packages changed files into deploy/<name>/files (mirroring the project tree) and zips it.
param(
  [string]$Name = "client-feedback-2026-10-20"
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root

$sourceFiles = @(
  'admin/controllers/newsController.ts',
  'admin/controllers/pagesController.ts',
  'admin/controllers/siteSettingsController.ts',
  'admin/controllers/sliderController.ts',
  'admin/routes/index.ts',
  'admin/services/siteSettingsService.ts',
  'src/app.ts',
  'src/controllers/formsController.ts',
  'src/controllers/homeController.ts',
  'src/controllers/pagesController.ts',
  'src/services/emailService.ts'
)

$otherFiles = @(
  'admin/views/home/sections.ejs',
  'admin/views/news/edit-news.ejs',
  'admin/views/pages/edit-page.ejs',
  'admin/views/pages/pages.ejs',
  'admin/views/site-settings/site-settings.ejs',
  'views/contact.ejs',
  'views/index.ejs',
  'views/partials/contact-form.ejs',
  'views/partials/contact-map.ejs',
  'views/partials/home-slider.ejs',
  'views/partials/shortcodes.ejs',
  'public/theme/solu.css',
  'scripts/import-solutec.js',
  'scripts/contact-placeholders.js',
  'scripts/remove-legacy-pages.js'
)

$compiled = foreach ($file in $sourceFiles) {
  $base = 'dist/' + ($file -replace '\.ts$', '')
  "$base.js"
  "$base.js.map"
}

$target = Join-Path $root "deploy/$Name"
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
$filesDir = Join-Path $target 'files'

foreach ($file in ($sourceFiles + $otherFiles + $compiled)) {
  if (-not (Test-Path $file)) { throw "Missing file: $file (run npm run build first)" }
  $dest = Join-Path $filesDir $file
  New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
  Copy-Item $file $dest
}

Copy-Item 'readme/deploy-client-feedback.md' (Join-Path $target 'DEPLOY.md')

$zip = Join-Path $root "deploy/$Name.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $target '*') -DestinationPath $zip

Write-Host "Packaged $((Get-ChildItem $filesDir -Recurse -File).Count) files into deploy/$Name and deploy/$Name.zip"
