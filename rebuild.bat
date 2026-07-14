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
echo Build complete! Products are in out\
echo Scroll.vbs will use out\ when it is newer than release\Scroll.exe
echo For a distributable zip, run pack.bat
pause
