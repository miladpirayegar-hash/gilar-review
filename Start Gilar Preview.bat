@echo off
setlocal
cd /d "%~dp0"
title Gilar Preview - Cloudflare with automatic fallback
echo.
echo Gilar synthetic preview launcher
echo The local desktop URL opens automatically. Keep this window open for public access.
echo Public tunnel order: Cloudflare Quick Tunnel, LocalTunnel, then Tunnelmole.
echo.
node "%~dp0scripts\start-gilar-preview.mjs"
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" echo The preview did not start. Check qa\preview\*.log for details.
echo Close this window to stop the preview, or use Stop Gilar Preview.bat for emergency cleanup.
pause >nul
exit /b %EXIT_CODE%
