@echo off
cd /d "%~dp0"

echo ==========================================
echo   Scroll - Build Portable EXE
echo ==========================================
echo.

echo [1/3] Building code...
call npx electron-vite build
if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo [2/3] Packaging Scroll.exe (3-5 minutes)...
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
call npx electron-builder --win portable
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ==========================================
    echo   Package failed! Check network connection.
    echo ==========================================
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   Done! Scroll.exe is in release\ folder.
echo   Double-click Scroll.vbs to launch daily.
echo ==========================================
start "" "release"
pause
