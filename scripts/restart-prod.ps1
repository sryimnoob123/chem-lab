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

Write-Host "[4/5] starting server ..."
New-Item -ItemType Directory -Force -Path "logs" | Out-Null
$env:PORT = "3001"
$env:HOSTNAME = "127.0.0.1"
$env:PGLITE_DIR = (Join-Path $root ".pgdata-prod2")
# 演示构建要能看到 Dev Dock（一键演示的兜底入口）：默认只在 NODE_ENV != production 时开，
# 生产构建必须显式给 DEVTOOLS=1（红队 2026-10-22 报 production 下 [data-dev] 为 0、/dev 404）。
$env:DEVTOOLS = "1"
$proc = Start-Process -FilePath "node" -ArgumentList ".next\standalone\server.js" `
  -WorkingDirectory $root `
  -RedirectStandardOutput "logs\server.log" `
  -RedirectStandardError "logs\server.err.log" `
  -WindowStyle Hidden -PassThru
$proc.Id | Set-Content "logs\server.pid" -Encoding ascii
Start-Sleep -Seconds 9

Write-Host "[5/5] verifying ..."
try {
  $home = Invoke-WebRequest "http://localhost:3001" -TimeoutSec 10 -UseBasicParsing
  Write-Host "      /            -> $($home.StatusCode)"
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
