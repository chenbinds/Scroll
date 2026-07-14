# Scroll pre-release smoke check (build + artifact verification)
# Usage: smoke-check.bat
#        powershell -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-check.ps1
#        powershell ... -File scripts/smoke-check.ps1 -SkipBuild

param(
    [switch]$SkipBuild,
    [switch]$CheckPortable
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
    Write-Host "  OK  $Msg" -ForegroundColor Green
}

function Write-Warn([string]$Msg) {
    Write-Host "  WARN  $Msg" -ForegroundColor Yellow
}

function Write-Fail([string]$Msg) {
    Write-Host "  FAIL  $Msg" -ForegroundColor Red
}

function Run-Step([string]$Name, [scriptblock]$Block) {
    Write-Step $Name
    try {
        & $Block
        Write-Ok $Name
        return $true
    } catch {
        Write-Fail "$Name — $($_.Exception.Message)"
        return $false
    }
}

$failed = 0

if (-not (Run-Step 'Typecheck (tsc --noEmit)' {
        npm run typecheck 2>&1 | Out-Host
        if ($LASTEXITCODE -ne 0) { throw "exit $LASTEXITCODE" }
    })) { $failed++ }

if (-not $SkipBuild) {
    if (-not (Run-Step 'Build (electron-vite build)' {
            npm run build 2>&1 | Out-Host
            if ($LASTEXITCODE -ne 0) { throw "exit $LASTEXITCODE" }
        })) { $failed++ }
} else {
    Write-Warn 'Build skipped (-SkipBuild)'
}

Write-Step 'Artifact checks'
$required = @(
    'out/main/index.js',
    'out/preload/index.js',
    'out/renderer/index.html'
)
foreach ($rel in $required) {
    $path = Join-Path $Root $rel
    if (Test-Path $path) {
        Write-Ok $rel
    } else {
        Write-Fail "Missing $rel"
        $failed++
    }
}

$css = Get-ChildItem -Path (Join-Path $Root 'out/renderer/assets') -Filter 'index-*.css' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($css) {
    Write-Ok "renderer CSS bundle ($($css.Name))"
} else {
    Write-Fail 'Missing out/renderer/assets/index-*.css'
    $failed++
}

if ($CheckPortable) {
    $exe = Join-Path $Root 'release/Scroll.exe'
    if (Test-Path $exe) {
        $sizeMb = [math]::Round((Get-Item $exe).Length / 1MB, 1)
        if ($sizeMb -gt 30) {
            Write-Ok "release/Scroll.exe (${sizeMb} MB)"
        } else {
            Write-Warn "release/Scroll.exe exists but small (${sizeMb} MB) — repack?"
        }
    } else {
        Write-Warn 'release/Scroll.exe not found — run pack.bat for portable smoke'
    }
}

Write-Host ""
Write-Host '========================================' -ForegroundColor Cyan
if ($failed -eq 0) {
    Write-Host 'Automated checks passed.' -ForegroundColor Green
} else {
    Write-Host "Automated checks failed ($failed issue(s))." -ForegroundColor Red
}

Write-Host ""
Write-Host 'Manual smoke (about 3 min):' -ForegroundColor Cyan
Write-Host '  1. rebuild.bat or Scroll.vbs cold start'
Write-Host '  2. Open an EPUB, scroll, add a bookmark or mark'
Write-Host '  3. Back to shelf (leave dialog if prompted) -> reopen same book'
Write-Host '  4. Progress roughly restored; TOC opens without blank screen'
Write-Host '  5. Theme dropdown matches dark/light; font size persists'
Write-Host ''
Write-Host 'Defender / antivirus: docs/06-troubleshooting.md' -ForegroundColor DarkGray
Write-Host '========================================' -ForegroundColor Cyan

if ($failed -gt 0) { exit 1 }
exit 0
