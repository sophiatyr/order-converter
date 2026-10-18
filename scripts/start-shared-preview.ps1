$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'start-local.ps1') -NoBrowser
$previewStatus = Invoke-RestMethod -Uri 'http://127.0.0.1:8888/api/local-system/api/shared/status' -TimeoutSec 10
if ($previewStatus.environment -ne 'preview') { throw 'Local system management is unavailable.' }
Write-Output 'System management is available at http://127.0.0.1:8888/.'
