@echo off
cd /d "%~dp0"
echo ==========================================================
echo    Building VK Mini App Archive (vk_app.zip)...
echo ==========================================================
echo.

node build_vk.cjs

echo.
pause

