@echo off
setlocal
cd /d "%~dp0"
docker compose -p darb up -d --wait --wait-timeout 180
if errorlevel 1 pause
