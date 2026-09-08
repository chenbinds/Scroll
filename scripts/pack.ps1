# Scroll one-click release pack (UTF-8)
# Usage: pack.bat  OR  powershell -File scripts/pack.ps1

param(
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

function Write-Step([string]$Msg) {
    Write-Host ""
    Write-Host $Msg -ForegroundColor Cyan
}

function Write-Ok([string]$Msg) {
    Write-Host $Msg -ForegroundColor Green
}

function Write-Err([string]$Msg) {
    Write-Host $Msg -ForegroundColor Red
}

function Get-AppVersion {
    $v = node -p "require('./package.json').version"
    if ($LASTEXITCODE -ne 0) { throw 'Failed to read version from package.json' }
    return [string]$v.Trim()
}

function Set-BuildEnv {
    # China-friendly mirrors (faster than GitHub)
    $env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
    $env:ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'
    # Skip code signing / winCodeSign download (no cert needed for portable exe)
    $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
    $env:CSC_LINK = ''
    $env:WIN_CSC_LINK = ''
}

function Import-OfflineBinaries {
    $offlineDir = Join-Path $Root 'tools\offline'
    $cacheRoot = Join-Path $env:LOCALAPPDATA 'electron-builder\Cache'
    if (-not (Test-Path $offlineDir)) { return 0 }

    $files = @(
        'winCodeSign-2.6.0.7z',
        'nsis-3.0.4.1.7z',
        'nsis-resources-3.4.1.7z'
    )

    $count = 0
    foreach ($name in $files) {
        $src = Join-Path $offlineDir $name
        if (-not (Test-Path $src)) { continue }

        $subdir = if ($name -like 'winCodeSign*') { 'winCodeSign' } else { 'nsis' }
        $destDir = Join-Path $cacheRoot $subdir
        New-Item -ItemType Directory -Force -Path $destDir | Out-Null

        # electron-builder may use hashed names; copy both canonical and hashed slot
        Copy-Item $src (Join-Path $destDir $name) -Force
        Get-ChildItem $destDir -Filter '*.7z' -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -ne $name } |
            ForEach-Object { Copy-Item $src $_.FullName -Force }

        $count++
        Write-Ok "  Offline cache: $name"

        # Pre-extract winCodeSign so rcedit is available (electron-builder extraction fails on darwin symlinks)
        if ($name -like 'winCodeSign*' -and -not (Test-Path (Join-Path $destDir 'winCodeSign-2.6.0\rcedit-x64.exe'))) {
            $sevenZip = Join-Path $Root 'node_modules\7zip-bin\win\x64\7za.exe'
            if (Test-Path $sevenZip) {
                $extractDir = Join-Path $destDir 'winCodeSign-2.6.0'
                # Extract ignoring darwin symlink errors (we only need Windows tools)
                & $sevenZip x -bd -y $src "-o$extractDir" 2>&1 | Out-Null
                if (Test-Path (Join-Path $extractDir 'rcedit-x64.exe')) {
                    Write-Ok "  Pre-extracted winCodeSign (rcedit ready)"
                }
            }
        }
    }
    return $count
}

function Import-RootDropins {
    # User may drop winCodeSign*.7z at project root (move into tools/offline)
    $dropins = Get-ChildItem $Root -Filter 'winCodeSign*.7z' -File -ErrorAction SilentlyContinue
    if ($dropins.Count -eq 0) { return }

    $offlineDir = Join-Path $Root 'tools\offline'
    New-Item -ItemType Directory -Force -Path $offlineDir | Out-Null
    foreach ($f in $dropins) {
        $dest = Join-Path $offlineDir $f.Name
        if (-not (Test-Path $dest)) {
            Move-Item $f.FullName $dest
            Write-Ok "  Moved $($f.Name) -> tools\offline\"
        }
    }
}

function Invoke-Npm([string[]]$Args) {
    & npm.cmd @Args
    if ($LASTEXITCODE -ne 0) { throw "npm failed: npm $($Args -join ' ')" }
}

function Invoke-LocalBin([string]$Name, [string[]]$CmdArgs) {
    $cmd = Join-Path $Root "node_modules\.bin\$Name.cmd"
    if (-not (Test-Path $cmd)) {
        throw "Missing $Name.cmd - run npm install first"
    }
    & $cmd @CmdArgs
    if ($LASTEXITCODE -ne 0) { throw "$Name failed (exit $LASTEXITCODE)" }
}

Write-Host '==========================================' -ForegroundColor Yellow
Write-Host '  Scroll - One-Click Release Pack' -ForegroundColor Yellow
Write-Host '  Portable folder + zip for distribution' -ForegroundColor Yellow
Write-Host '==========================================' -ForegroundColor Yellow

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Err '[ERROR] Node.js not found. Install Node 20+ on THIS machine only.'
    Write-Err '        Recipients only need Scroll.exe - no Node required.'
    exit 1
}

$version = Get-AppVersion
Write-Host "Version: $version"

Set-BuildEnv
Import-RootDropins
$offlineCount = Import-OfflineBinaries
if ($offlineCount -gt 0) {
    Write-Ok "[offline] Seeded $offlineCount binary cache file(s) from tools\offline\"
}

$electronExe = Join-Path $Root 'node_modules\electron\dist\electron.exe'
if (-not $SkipInstall -and -not (Test-Path $electronExe)) {
    Write-Step '[1/4] Installing dependencies (first run, ~3-5 min)...'
    Invoke-Npm @('install')
} else {
    Write-Step '[1/4] Dependencies OK - skipped'
}

Write-Step '[2/4] Building application...'
Invoke-LocalBin 'electron-vite' @('build')

Write-Step '[3/4] Packaging portable folder (no code signing)...'
Write-Host '  Using npmmirror for builder binaries; winCodeSign is skipped.'
# Ensure no running instance locks release\win-unpacked\Scroll.exe
Get-Process -Name 'Scroll' -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host '  Closing running Scroll.exe before packaging...' -ForegroundColor Yellow
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 500
Invoke-LocalBin 'electron-builder' @('--win', 'dir')

$unpackedDir = Join-Path $Root 'release\win-unpacked'
$exePath = Join-Path $unpackedDir 'Scroll.exe'
if (-not (Test-Path $exePath)) {
    Write-Err '[ERROR] release\win-unpacked\Scroll.exe not found.'
    exit 1
}

# --- Embed app icon into Scroll.exe via rcedit ---
# Generate fresh ICO from PNG (multi-size, proper BMP format)
$makeIcoScript = Join-Path $PSScriptRoot 'make-ico.js'
if (Test-Path $makeIcoScript) {
    node $makeIcoScript
}

$rceditPath = Join-Path $env:LOCALAPPDATA 'electron-builder\Cache\winCodeSign\winCodeSign-2.6.0\rcedit-x64.exe'
$iconPath = Join-Path $Root 'resources\icon.ico'
if ((Test-Path $rceditPath) -and (Test-Path $iconPath)) {
    Write-Step 'Embedding app icon into Scroll.exe...'
    & $rceditPath $exePath --set-icon $iconPath --set-version-string "ProductName" "Scroll" --set-version-string "FileDescription" "Scroll eBook Reader"
    if ($LASTEXITCODE -eq 0) {
        Write-Ok '  Icon embedded successfully.'
    } else {
        Write-Err "  rcedit failed (exit $LASTEXITCODE) - icon not set."
    }
} else {
    if (-not (Test-Path $rceditPath)) { Write-Err "  rcedit not found at: $rceditPath" }
    if (-not (Test-Path $iconPath))   { Write-Err "  icon.ico not found at: $iconPath" }
}
# --- End icon embedding ---

Write-Step '[4/4] Creating dist folder and zip...'
& (Join-Path $PSScriptRoot 'pack-release.ps1') -Root $Root -Version $version

Write-Host ''
Write-Host '==========================================' -ForegroundColor Green
Write-Host '  Pack complete!' -ForegroundColor Green
Write-Host ''
Write-Host "  Send: dist\Scroll-$version-win-x64.zip"
Write-Host "    or: dist\Scroll-$version-win-x64\"
Write-Host ''
Write-Host '  Recipients: unzip folder and run Scroll.exe (Win10/11 x64)'
Write-Host '==========================================' -ForegroundColor Green

Start-Process explorer.exe (Join-Path $Root 'dist')
exit 0
