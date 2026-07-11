@echo off
cd /d "%~dp0"

echo ==========================================
echo   Scroll Ebook Reader - Launch
echo ==========================================
echo.

echo [1/2] Checking dependencies...
if not exist "node_modules" (
    echo   node_modules not found! Please run install.bat first.
    pause
    exit /b 1
)

if not exist "node_moduleslectron\dist" (
    echo   Electron not fully installed, completing setup...
    set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
    call npm install
)

echo [2/2] Starting app...
echo.
echo   App is launching, please wait...
echo   Close this window to exit the app.
echo ==========================================
echo.

call npm run dev

pause
