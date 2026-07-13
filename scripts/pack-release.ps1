param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$Version
)

$ErrorActionPreference = 'Stop'

$distName = "Scroll-$Version-win-x64"
$distRoot = Join-Path $Root 'dist'
$distDir = Join-Path $distRoot $distName
$exeSrc = Join-Path $Root 'release\Scroll.exe'
$exeDst = Join-Path $distDir 'Scroll.exe'
$readmePath = Join-Path $distDir 'README.txt'
$zipPath = Join-Path $distRoot "$distName.zip"

if (-not (Test-Path $exeSrc)) {
    Write-Error 'Missing release\Scroll.exe - electron-builder may have failed.'
}

if (Test-Path $distDir) { Remove-Item $distDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $distDir | Out-Null
Copy-Item $exeSrc $exeDst -Force

$templatePath = Join-Path $PSScriptRoot 'README.dist.txt'
if (-not (Test-Path $templatePath)) {
    Write-Error 'Missing scripts\README.dist.txt template'
}
$readme = [System.IO.File]::ReadAllText($templatePath, [System.Text.UTF8Encoding]::new($false))
$readme = $readme.Replace('{version}', $Version)
$utf8Bom = New-Object System.Text.UTF8Encoding $true
[System.IO.File]::WriteAllText($readmePath, $readme, $utf8Bom)

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path $distDir -DestinationPath $zipPath -Force

Write-Host ""
Write-Host "Release folder: $distDir"
Write-Host "Release zip:    $zipPath"
Write-Host "Exe size:       $([math]::Round((Get-Item $exeDst).Length / 1MB, 1)) MB"
Write-Host "Zip size:       $([math]::Round((Get-Item $zipPath).Length / 1MB, 1)) MB"
