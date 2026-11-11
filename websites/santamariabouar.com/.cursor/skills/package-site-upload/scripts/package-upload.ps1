param(
    [Parameter(Mandatory = $true)]
    [string]$Name,

    [Parameter(Mandatory = $true)]
    [string[]]$Files
)

$ErrorActionPreference = "Stop"

if ($Name -notmatch '^[a-z0-9]+(-[a-z0-9]+)*$') {
    throw "Name must be a lowercase slug (letters, numbers, hyphens)."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")
Set-Location $repoRoot

$destRoot = Join-Path $repoRoot "deploy\$Name"
$zipPath = Join-Path $repoRoot "deploy\$Name.zip"

if (Test-Path $destRoot) {
    Get-ChildItem -Path $destRoot -Force | Where-Object { $_.Name -ne "README.md" } | Remove-Item -Recurse -Force
} else {
    New-Item -ItemType Directory -Path $destRoot -Force | Out-Null
}

$copied = @()
foreach ($rel in $Files) {
    $normalized = $rel -replace '\\', '/'
    if ($normalized -match '(^|/)\.env' -or $normalized -match '^(node_modules|dist|deploy|coverage)/' -or $normalized -match '^public/uploads/') {
        throw "Refusing to package: $normalized"
    }

    $source = Join-Path $repoRoot ($normalized -replace '/', '\')
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        throw "File not found: $normalized"
    }

    $target = Join-Path $destRoot ($normalized -replace '/', '\')
    $targetDir = Split-Path -Parent $target
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $target -Force
    $copied += $normalized
}

if (Test-Path $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

$payload = Get-ChildItem -Path $destRoot -Force | Where-Object { $_.Name -ne "README.md" }
if (-not $payload) {
    throw "Nothing to zip."
}

Compress-Archive -Path ($payload | ForEach-Object { $_.FullName }) -DestinationPath $zipPath -CompressionLevel Optimal

Write-Output "Folder: deploy/$Name"
Write-Output "Zip:    deploy/$Name.zip"
Write-Output "Files:"
$copied | ForEach-Object { Write-Output "  $_" }
