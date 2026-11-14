@echo off
set "PATH=%~dp0.tools\node-v24.11.1-win-x64;%PATH%"
cd /d "%~dp0"
call npm.cmd start
pause
