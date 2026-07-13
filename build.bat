@echo off
REM Forwards to pack.bat (one-click release)
cd /d "%~dp0"
call "%~dp0pack.bat"
