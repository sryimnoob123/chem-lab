@echo off
chcp 65001 >nul
setlocal
rem ============================================================
rem  stop-chem-lab.bat  停止由 start-chem-lab 启动的服务
rem ============================================================
cd /d "%~dp0"

set "PIDFILE=%~dp0logs\server.pid"
if not exist "%PIDFILE%" (
  echo   没找到 logs\server.pid，服务可能不是用 start-chem-lab 起的。
  echo   如需手动查：Get-NetTCPConnection -LocalPort 3001 -State Listen
  pause
  exit /b 1
)

set /p SRVPID=<"%PIDFILE%"
echo   正在停止 PID %SRVPID% ...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$id=[int]'%SRVPID%'; $p=Get-Process -Id $id -ErrorAction SilentlyContinue; if($p){ Stop-Process -Id $id; Start-Sleep -Milliseconds 800; if(Get-Process -Id $id -ErrorAction SilentlyContinue){ Write-Host '  进程仍在，稍等再试' } else { Write-Host '  已停止' } } else { Write-Host '  进程不存在（可能已退出）' }"

del /q "%PIDFILE%" >nul 2>nul
echo.
echo   提示：PGlite 对强制结束敏感。若下次启动后登录接口返回 500，
echo         说明数据目录已损坏，请改用新的 -DbDir 目录重新初始化：
echo         start-chem-lab.bat -DbDir .pgdata-prod3
echo.
pause
endlocal
