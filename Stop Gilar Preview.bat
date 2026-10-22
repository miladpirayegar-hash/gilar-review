@echo off
setlocal
cd /d "%~dp0"
title Stop Gilar Quick Tunnel Preview
node "%~dp0scripts\stop-gilar-preview.mjs"
echo.
pause
