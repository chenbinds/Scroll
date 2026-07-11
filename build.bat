@echo off
cd /d "%~dp0"

echo ==========================================
echo   Scroll Ebook Reader - Build ^& Package
echo ==========================================
echo.

echo [1/2] Building code...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo [2/2] Packaging Windows installer (3-5 minutes)...
call npm run package

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Package failed!
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   Build complete! Output in release\ folder.
echo ==========================================
pause
