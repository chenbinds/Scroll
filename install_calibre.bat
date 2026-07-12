@echo off
cd /d "%~dp0"

echo ===================================
echo   Scroll - Install Calibre Converter
echo ===================================
echo.
echo This will download Calibre Portable (~300MB)
echo and extract ebook-convert for MOBI/AZW3 support.
echo.

set CALIBRE_URL=https://calibre-ebook.com/dist/portable
set CALIBRE_DIR=%USERPROFILE%\calibre-portable
set TEMP_ZIP=%TEMP%\calibre-portable.zip

if exist "%CALIBRE_DIR%\ebook-convert.exe" (
    echo Calibre already installed at %CALIBRE_DIR%
    goto done
)

echo Downloading Calibre Portable...
curl -L -o "%TEMP_ZIP%" "%CALIBRE_URL%" 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Download failed! Please install Calibre manually from:
    echo https://calibre-ebook.com/download_windows
    pause
    exit /b 1
)

echo Extracting...
mkdir "%CALIBRE_DIR%" 2>nul
tar -xf "%TEMP_ZIP%" -C "%CALIBRE_DIR%" 2>&1
del "%TEMP_ZIP%"

if exist "%CALIBRE_DIR%\ebook-convert.exe" (
    echo.
    echo ===================================
    echo   Installation complete!
    echo   Calibre installed at: %CALIBRE_DIR%
    echo ===================================
) else (
    echo.
    echo Extraction may have failed.
    echo Please install Calibre manually from:
    echo https://calibre-ebook.com/download_windows
)

:done
pause
