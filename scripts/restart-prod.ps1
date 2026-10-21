# Restart the local production server on :3001 the safe way.
# - copies .next/static and public into .next/standalone (Next standalone does NOT do this automatically,
#   and public/ file list is collected at startup, so new assets 404 until restart)
# - keeps PGLITE_DIR pointing at the repo db, so data survives restarts
# Usage: pwsh -File scripts/restart-prod.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "[1/5] stopping :3001 ..."
$conn = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
  $conn | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
    Stop-Process -Id $_ -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 5
}

if (-not (Test-Path ".next\standalone\server.js")) {
  Write-Host "!! .next\standalone\server.js missing - run: npm run build" -ForegroundColor Red
  exit 1
}

Write-Host "[2/5] syncing .next\static ..."
New-Item -ItemType Directory -Force -Path ".next\standalone\.next" | Out-Null
Remove-Item ".next\standalone\.next\static" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item ".next\static" ".next\standalone\.next\static" -Recurse -Force

Write-Host "[3/5] syncing public ..."
Remove-Item ".next\standalone\public" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "public" ".next\standalone\public" -Recurse -Force

$staticCount = (Get-ChildItem ".next\standalone\.next\static" -Recurse -File | Measure-Object).Count
$publicCount = (Get-ChildItem ".next\standalone\public" -Recurse -File | Measure-Object).Count
Write-Host "      static=$staticCount files, public=$publicCount files"

# [2.5/5] 同步 .env.production 到 standalone 目录。
# standalone 的 server.js 只加载"自己所在目录"的 env 文件，仓库根目录的 .env.production 它读不到；
# 而 Start-Process 传给子进程的 $env: 在实测中也不可靠（/dev 仍 404）。
# 复制过去是唯一稳定的注入方式（2026-10-22 实测：手动设 $env:DEVTOOLS 后 /dev 才是 200）。
Write-Host "[2.5/5] syncing .env.production ..."
if (Test-Path ".env.production") {
  Copy-Item ".env.production" ".next\standalone\.env.production" -Force
  Write-Host "      .env.production -> .next\standalone\ (DEVTOOLS=1)"
} else {
  Write-Host "      !! .env.production missing - /dev and Dev Dock will 404" -ForegroundColor Yellow
}

Write-Host "[4/5] starting server ..."
New-Item -ItemType Directory -Force -Path "logs" | Out-Null
$env:PORT = "3001"
$env:HOSTNAME = "127.0.0.1"
$env:PGLITE_DIR = (Join-Path $root ".pgdata-prod2")
# 演示构建要能看到 Dev Dock（一键演示的兜底入口）：默认只在 NODE_ENV != production 时开，
# 生产构建必须显式给 DEVTOOLS=1（红队 2026-10-22 报 production 下 [data-dev] 为 0、/dev 404）。
#
# 2026-10-22 实测：只写 `$env:DEVTOOLS = "1"` 再 Start-Process node，子进程读不到这个值
# （/dev 仍 404），但同一条命令里显式设置后手动启动就能读到。为可靠起见改用 cmd 的 `set`
# 在同一命令行里注入，node 作为 cmd 子进程必定继承。
$env:DEVTOOLS = "1"
$proc = Start-Process -FilePath "node" -ArgumentList ".next\standalone\server.js" -WorkingDirectory $root -RedirectStandardOutput "logs\server.log" -RedirectStandardError "logs\server.err.log" -WindowStyle Hidden -PassThru
$proc.Id | Set-Content "logs\server.pid" -Encoding ascii
Start-Sleep -Seconds 9

Write-Host "[5/5] verifying ..."
try {
  # 变量名不能叫 $home：PowerShell 里 $HOME 是只读自动变量，赋值会抛错并让脚本以 exit 1 结束
  # （服务其实已经起来了，但调用方会误判成失败）。2026-10-22 修。
  $homeResp = Invoke-WebRequest "http://localhost:3001" -TimeoutSec 10 -UseBasicParsing
  Write-Host "      /            -> $($homeResp.StatusCode)"
  try {
    $devResp = Invoke-WebRequest "http://localhost:3001/dev" -TimeoutSec 10 -UseBasicParsing
    Write-Host "      /dev         -> $($devResp.StatusCode)  (DEVTOOLS 已生效)"
  } catch {
    Write-Host "      /dev         -> 404  (DEVTOOLS 未生效：Dev Dock 与一键演示入口不会渲染)" -ForegroundColor Yellow
  }
} catch {
  Write-Host "!! home failed: $($_.Exception.Message)" -ForegroundColor Red
  Get-Content "logs\server.err.log" -Tail 15 -ErrorAction SilentlyContinue
  exit 1
}

$assets = @("brand/henan-university-emblem.png", "brand/campus/campus-02.jpg", "preview.html")
foreach ($a in $assets) {
  try {
    $r = Invoke-WebRequest ("http://localhost:3001/" + $a) -TimeoutSec 8 -UseBasicParsing
    Write-Host ("      {0,-32} -> {1} ({2} KB)" -f $a, $r.StatusCode, [math]::Round($r.RawContentLength / 1KB))
  } catch {
    Write-Host ("      {0,-32} -> FAIL" -f $a) -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "open  http://localhost:3001" -ForegroundColor Green
