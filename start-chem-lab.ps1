<#
  start-chem-lab.ps1 —— 一键启动生产态服务
  用法：powershell -ExecutionPolicy Bypass -File .\start-chem-lab.ps1 [-Port 3001] [-DbDir .pgdata-prod2] [-SkipBuild]

  行为：
    1. 检查端口（被占只提示，绝不硬杀）
    2. 单次 npm run build（可 -SkipBuild 跳过，用于产物已是最新）
    3. 拷静态资源到 standalone
    4. 后台起 node .next/standalone/server.js，日志落 logs/server.log
    5. 轮询到 HTTP 200 后打印访问地址
#>
param(
  [int]$Port = 3001,
  [string]$DbDir = ".pgdata-prod2",
  [switch]$SkipBuild,
  [switch]$NoOpen
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Write-Step($msg) { Write-Host "[chem-lab] $msg" -ForegroundColor Cyan }
function Write-Warn2($msg) { Write-Host "[chem-lab] $msg" -ForegroundColor Yellow }
function Write-Bad($msg) { Write-Host "[chem-lab] $msg" -ForegroundColor Red }

# ---- 1. 端口检查：被占只提示，不硬杀 ----
$listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($listening) {
  $pids = ($listening | Select-Object -ExpandProperty OwningProcess -Unique) -join ", "
  Write-Warn2 "端口 $Port 已被占用（PID: $pids）。"
  Write-Warn2 "脚本不会自动结束它。要改用别的端口：.\start-chem-lab.ps1 -Port 3002"
  Write-Warn2 "要停掉本项目的服务：双击 stop-chem-lab.bat"
  exit 1
}

# ---- 2. 依赖与数据库 ----
if (-not (Test-Path "node_modules")) {
  Write-Step "首次运行，安装依赖…"
  npm install
  if ($LASTEXITCODE -ne 0) { Write-Bad "npm install 失败"; exit 1 }
}

$dbPath = if ([System.IO.Path]::IsPathRooted($DbDir)) { $DbDir } else { Join-Path $root $DbDir }
if (-not (Test-Path $dbPath)) {
  Write-Step "数据库目录不存在，初始化 $DbDir …"
  $env:PGLITE_DIR = $dbPath
  npm run db:init
  if ($LASTEXITCODE -ne 0) { Write-Bad "db:init 失败"; exit 1 }
  npm run db:demo
  if ($LASTEXITCODE -ne 0) { Write-Bad "db:demo 失败"; exit 1 }
}

# ---- 3. 构建（单次，不并发）----
if (-not $SkipBuild) {
  Write-Step "构建生产产物（cpus:4，约 18 秒）…"
  npm run build
  if ($LASTEXITCODE -ne 0) { Write-Bad "构建失败，已中止"; exit 1 }
} else {
  Write-Step "跳过构建（-SkipBuild）"
}

if (-not (Test-Path ".next\standalone\server.js")) {
  Write-Bad "找不到 .next/standalone/server.js —— 请先不带 -SkipBuild 跑一次"
  exit 1
}

# ---- 4. 拷静态资源 ----
Write-Step "复制静态资源到 standalone…"
New-Item -ItemType Directory -Force -Path ".next\standalone\.next" | Out-Null
Copy-Item ".next\static" ".next\standalone\.next\static" -Recurse -Force
Copy-Item "public" ".next\standalone\public" -Recurse -Force
# 清掉 standalone 里可能被带进去的空库副本，避免它抢占数据
$stale = Join-Path (Resolve-Path ".next\standalone").Path ".pgdata"
if (Test-Path $stale) { Remove-Item $stale -Recurse -Force }

# ---- 5. 后台启动 ----
New-Item -ItemType Directory -Force -Path "logs" | Out-Null
$logFile = Join-Path $root "logs\server.log"
$errFile = Join-Path $root "logs\server.err.log"
$env:PORT = "$Port"
$env:HOSTNAME = "127.0.0.1"
$env:PGLITE_DIR = $dbPath

Write-Step "启动服务（端口 $Port，库 $DbDir）…"
$proc = Start-Process -FilePath "node" `
  -ArgumentList ".next\standalone\server.js" `
  -WorkingDirectory $root `
  -RedirectStandardOutput $logFile `
  -RedirectStandardError $errFile `
  -WindowStyle Hidden `
  -PassThru

$proc.Id | Set-Content -Path "logs\server.pid" -Encoding ascii

# ---- 6. 轮询到 200 ----
$url = "http://localhost:$Port"
$ready = $false
for ($i = 0; $i -lt 45; $i++) {
  Start-Sleep -Milliseconds 800
  if ($proc.HasExited) { break }
  try {
    $r = Invoke-WebRequest $url -TimeoutSec 3 -UseBasicParsing
    if ($r.StatusCode -eq 200) { $ready = $true; break }
  } catch { }
}

Write-Host ""
if ($ready) {
  Write-Host "  ✓ 已启动  $url" -ForegroundColor Green
  Write-Host "    学生：20250101 / 周若曦      教师口令：2026" -ForegroundColor Gray
  Write-Host "    一键演示：首页右上角「一键演示」" -ForegroundColor Gray
  Write-Host "    日志：logs\server.log        停止：stop-chem-lab.bat" -ForegroundColor Gray
  Write-Host ""
  if (-not $NoOpen) { Start-Process $url }
} else {
  Write-Bad "启动失败或超时（进程 PID $($proc.Id)，HasExited=$($proc.HasExited)）"
  Write-Bad "看日志：$logFile"
  if (Test-Path $errFile) {
    Write-Bad "错误输出（末 20 行）："
    Get-Content $errFile -Tail 20 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
  }
  exit 1
}
