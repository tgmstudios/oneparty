@echo off
rem One-click PARTY launcher: doctor check, then hub + borderless fullscreen displays (use `npm run party` for windowed dev).
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js not found. Install: winget install OpenJS.NodeJS.LTS & pause & exit /b 1)
call npm run doctor
echo.
echo Starting hub and displays. Control panel: http://127.0.0.1:8787/control.html
call npm run party -- --kiosk --lan
pause
