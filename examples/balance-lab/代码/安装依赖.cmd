@echo off
cd /d "%~dp0"
call npm.cmd ci --no-audit --no-fund
if errorlevel 1 goto failed
call npm.cmd run build
if errorlevel 1 goto failed
echo Build complete. Use the start script.
exit /b 0
:failed
echo Installation or build failed. Check Node.js version and network.
pause
exit /b 1
