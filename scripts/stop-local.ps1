$ErrorActionPreference = 'Stop'
try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8888/api/local-health' -TimeoutSec 2
} catch {
    Write-Host '訂單系統目前沒有執行。'
    exit 0
}
$serverScript = Join-Path $PSScriptRoot 'local-server.mjs'
if ($health.app -ne 'order-converter-local' -or -not $health.pid) { throw '8888 不是此工作站的服務，不會停止其他程式。' }
$serverInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $($health.pid)"
if ($serverInfo.Name -ne 'node.exe' -or -not $serverInfo.CommandLine.Contains($serverScript)) { throw '無法確認服務來源，不會停止其他程式。' }
$runningServer = [Diagnostics.Process]::GetProcessById([int]$health.pid)
$runningServer.Kill()
if (-not $runningServer.WaitForExit(5000)) { throw '服務尚未完全停止，請稍後再試。' }
Write-Host '訂單系統已停止；雙擊啟動訂單系統.bat 可再次使用。'
