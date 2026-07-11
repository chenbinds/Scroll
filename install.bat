@echo off
cd /d "%~dp0"

echo ==========================================
echo   Scroll Ebook Reader - Install Dependencies
echo ==========================================
echo.

echo [1/3] Cleaning up stuck processes...
taskkill /F /IM node.exe >/dev/null 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   Cleaned up leftover node processes
) else (
    echo   No cleanup needed
)

echo [2/3] Cleaning old electron if present...
if exist "node_moduleslectron" (
    echo   Removing old electron...
    rmdir /S /Q "node_moduleslectron" >/dev/null 2>&1
)

echo [3/3] Installing dependencies (may take 3-5 minutes)...
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ==========================================
    echo   INSTALL FAILED! Check your network and retry.
    echo ==========================================
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   Install complete! Double-click start.bat to launch.
echo ==========================================
pause
