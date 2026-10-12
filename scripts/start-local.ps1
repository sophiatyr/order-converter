$ErrorActionPreference = 'Stop'
$NoBrowser = $args -contains '-NoBrowser'
$projectPath = Split-Path -Parent $PSScriptRoot
$appUrl = 'http://localhost:8888'
$healthUrl = 'http://127.0.0.1:8888/api/local-health'

function Test-OrderConverter {
    try {
        $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
        return $health.app -eq 'order-converter-local'
    } catch { return $false }
}

if (Test-OrderConverter) {
    if (-not $NoBrowser) { Start-Process $appUrl }
    Write-Host '系統已在執行：http://localhost:8888'
    exit 0
}

if (Get-NetTCPConnection -LocalPort 8888 -State Listen -ErrorAction SilentlyContinue) {
    throw '連接埠 8888 已被其他程式使用。請先關閉該程式，再重新啟動。'
}
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    throw '此電腦未安裝 Node.js。請安裝 Node.js 22 或以上版本後再啟動。'
}

$logPath = Join-Path $projectPath 'work'
New-Item -ItemType Directory -Path $logPath -Force | Out-Null
$serverScript = Join-Path $PSScriptRoot 'local-server.mjs'
$serverProcess = Start-Process -FilePath $nodeCommand.Source -ArgumentList @('"' + $serverScript + '"') -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logPath 'local-server.log') -RedirectStandardError (Join-Path $logPath 'local-server-error.log') -PassThru
try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($serverProcess.HasExited) { throw '本機服務未能啟動。' }
        if (Test-OrderConverter) { $ready = $true; break }
        Start-Sleep -Milliseconds 250
    }
    if (-not $ready) { throw '本機服務啟動逾時，請重試。' }
    if (-not $NoBrowser) { Start-Process $appUrl }
    Write-Host '成衣訂單轉換系統已啟動：http://localhost:8888'
    Write-Host 'Excel／CSV／PDF／圖片／文字全部使用本機辨識，不需要 API。'
    Write-Host '系統已在背景執行，關閉此視窗不會停止服務。'
    Write-Host '要停止時請雙擊「停止訂單系統.bat」。電腦重新開機後請再次啟動。'
} catch {
    if (-not $serverProcess.HasExited) { Stop-Process -Id $serverProcess.Id -ErrorAction SilentlyContinue }
    throw
}
