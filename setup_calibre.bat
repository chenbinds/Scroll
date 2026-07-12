@echo off
cd /d "%~dp0"

echo ===================================
echo   Scroll - Setup Calibre Portable
echo   (~130MB download, one time only)
echo ===================================
echo.

set TOOLS_DIR=%~dp0tools
set CALIBRE_DIR=%TOOLS_DIR%\calibre-portable
set ZIP=%TEMP%\calibre-portable.zip

if exist "%CALIBRE_DIR%\Calibre\ebook-convert.exe" (
    echo Calibre Portable already set up.
    goto done
)

echo Downloading Calibre Portable... (this may take a few minutes)
echo.

powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://calibre-ebook.com/dist/portable' -OutFile '%ZIP%'}"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Download failed.
    echo You can manually download Calibre Portable from:
    echo   https://calibre-ebook.com/download_portable
    echo.
    echo Extract it to: %CALIBRE_DIR%
    echo So that ebook-convert.exe is at: %CALIBRE_DIR%\Calibre\ebook-convert.exe
    pause
    exit /b 1
)

echo.
echo Extracting...
mkdir "%CALIBRE_DIR%" 2>nul
powershell -Command "Expand-Archive -Path '%ZIP%' -DestinationPath '%CALIBRE_DIR%' -Force"
del "%ZIP%"

if exist "%CALIBRE_DIR%\Calibre\ebook-convert.exe" (
    echo.
    echo ===================================
    echo   Setup complete!
    echo ===================================
) else (
    echo.
    echo Extraction may have failed.
    echo Please manually extract Calibre Portable to:
    echo   %CALIBRE_DIR%
)

:done
echo.
pause
