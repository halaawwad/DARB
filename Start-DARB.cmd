@echo off
setlocal
cd /d "%~dp0"
set "PATH=%~dp0.tools\node-v24.11.1-win-x64;%PATH%"
powershell -NoProfile -Command "try { $r = Invoke-WebRequest 'http://localhost:8081' -UseBasicParsing -TimeoutSec 2; if ($r.Content -match '<title>Darb</title>') { Start-Process 'http://localhost:8081/finance'; exit 0 } } catch {}; exit 1"
if not errorlevel 1 exit /b 0
call npm.cmd run web -- --port 8081
pause
