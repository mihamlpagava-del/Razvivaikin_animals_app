@echo off
cd /d "%~dp0"

echo ==========================================================
echo Starting Kids Animal Game (VK Mini App)...
echo Opening http://localhost:3000 in your browser...
echo ==========================================================

start http://localhost:3000
node server.cjs

if %errorlevel% neq 0 (
    echo.
    echo Node.js is not found or failed to start.
    echo Please make sure Node.js is installed from https://nodejs.org/
    pause
)
