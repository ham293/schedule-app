@echo off
rem Schedule app launcher (ASCII only to avoid codepage issues)
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Please install from https://nodejs.org/
  pause
  exit /b 1
)
echo Starting schedule app...
start "Schedule App" /min cmd /c "node server-local.js"
timeout /t 1 /nobreak >nul
start "" "http://localhost:8099"
exit
