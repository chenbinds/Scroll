param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$Version
)

$ErrorActionPreference = 'Stop'

function Stop-ScrollApp {
    $procs = @(Get-Process -Name 'Scroll' -ErrorAction SilentlyContinue)
    if ($procs.Count -eq 0) { return }

    Write-Host "  Closing $($procs.Count) running Scroll.exe instance(s)..." -ForegroundColor Yellow
    foreach ($p in $procs) {
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 800
}

function Remove-PathRetry {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [int]$Retries = 4
    )
    if (-not (Test-Path $Path)) { return }

    for ($i = 1; $i -le $Retries; $i++) {
        try {
            Remove-Item $Path -Recurse -Force -ErrorAction Stop
            return
        } catch {
            if ($i -lt $Retries) {
                Stop-ScrollApp
                Start-Sleep -Milliseconds 600
            } else {
                throw "Cannot remove locked path: $Path — close Scroll.exe and retry."
            }
        }
    }
}

$distName = "Scroll-$Version-win-x64"
$distRoot = Join-Path $Root 'dist'
$distDir = Join-Path $distRoot $distName
$unpackedDir = Join-Path $Root 'release\win-unpacked'
$exeDst = Join-Path $distDir 'Scroll.exe'
$readmePath = Join-Path $distDir 'README.txt'
$zipPath = Join-Path $distRoot "$distName.zip"

if (-not (Test-Path $unpackedDir)) {
    Write-Error 'Missing release\win-unpacked - electron-builder may have failed.'
}
if (-not (Test-Path (Join-Path $unpackedDir 'Scroll.exe'))) {
    Write-Error 'Missing release\win-unpacked\Scroll.exe - electron-builder may have failed.'
}

# Close app if still running from a previous dist/ or release/ test
Stop-ScrollApp

# Stage outside dist/ so a running instance cannot lock files we are zipping
$staging = Join-Path $env:TEMP ("scroll-pack-" + [guid]::NewGuid().ToString('n'))
$stagingFolder = Join-Path $staging $distName
New-Item -ItemType Directory -Force -Path $stagingFolder | Out-Null
Copy-Item -Path (Join-Path $unpackedDir '*') -Destination $stagingFolder -Recurse -Force

$templatePath = Join-Path $PSScriptRoot 'README.dist.txt'
if (-not (Test-Path $templatePath)) {
    Write-Error 'Missing scripts\README.dist.txt template'
}
$readme = [System.IO.File]::ReadAllText($templatePath, [System.Text.UTF8Encoding]::new($false))
$readme = $readme.Replace('{version}', $Version)
$utf8Bom = New-Object System.Text.UTF8Encoding $true
[System.IO.File]::WriteAllText((Join-Path $stagingFolder 'README.txt'), $readme, $utf8Bom)

$zipTemp = Join-Path $env:TEMP ("scroll-pack-" + [guid]::NewGuid().ToString('n') + '.zip')
if (Test-Path $zipTemp) { Remove-Item $zipTemp -Force }
Compress-Archive -Path $stagingFolder -DestinationPath $zipTemp -Force

Stop-ScrollApp
Remove-PathRetry $distDir
Remove-PathRetry $zipPath

New-Item -ItemType Directory -Force -Path $distRoot | Out-Null
Move-Item $stagingFolder $distDir
Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
Move-Item $zipTemp $zipPath

$folderSizeMb = [math]::Round(
    ((Get-ChildItem $distDir -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB),
    1
)

Write-Host ""
Write-Host "Release folder: $distDir"
Write-Host "Release zip:    $zipPath"
Write-Host "Folder size:    ${folderSizeMb} MB"
Write-Host "Exe:            $exeDst"
Write-Host "Zip size:       $([math]::Round((Get-Item $zipPath).Length / 1MB, 1)) MB"
