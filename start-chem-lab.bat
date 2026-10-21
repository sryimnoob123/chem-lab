@echo off
chcp 65001 >nul
setlocal
rem ============================================================
rem  start-chem-lab.bat  双击启动（生产态 standalone，默认 3001）
rem  可带参数：start-chem-lab.bat -Port 3002 -DbDir .pgdata-test -SkipBuild
rem ============================================================
cd /d "%~dp0"
echo.
echo   chem-lab 启动中，请稍候（首次会构建，约 20 秒）...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-chem-lab.ps1" %*
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo   启动未成功，退出码 %RC%。看日志：logs\server.log
)
pause
endlocal
exit /b %RC%
