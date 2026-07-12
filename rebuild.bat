@echo off
cd /d "%~dp0"

echo ===================================
echo   Scroll - Quick Rebuild (No Package)
echo ===================================
echo.

call npx electron-vite build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo Build complete! You can now run Scroll.vbs
pause
