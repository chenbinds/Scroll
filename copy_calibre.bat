@echo off
cd /d "%~dp0"

echo ===================================
echo   Copy Calibre to project tools
echo ===================================
echo.

set SRC=C:\Program Files\Calibre2
set DST=%~dp0tools\calibre-portable\Calibre

if exist "%DST%\ebook-convert.exe" (
    echo Already exists at %DST%
    pause
    exit /b 0
)

if not exist "%SRC%\ebook-convert.exe" (
    echo Calibre not found at %SRC%
    echo Please install Calibre first or run setup_calibre.bat
    pause
    exit /b 1
)

echo Copying from %SRC% ...
echo This may take a minute...

mkdir "%DST%" 2>nul
xcopy "%SRC%\*" "%DST%\" /E /I /Q /H

if exist "%DST%\ebook-convert.exe" (
    echo.
    echo ===================================
    echo   Done! Calibre copied to tools\
    echo ===================================
) else (
    echo.
    echo Copy failed. Try setup_calibre.bat instead.
)

pause
