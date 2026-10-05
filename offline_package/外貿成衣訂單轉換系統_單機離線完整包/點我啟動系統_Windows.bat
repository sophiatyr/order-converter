@echo off
chcp 65001 >nul
title 外貿成衣訂單轉換系統 - 單機離線完整版
cls
echo ========================================================================
echo   外貿成衣訂單轉換系統 (單機離線完整版)
echo   P/I 生成 ‧ 工廠採購單 ‧ 5欄產品清單 Excel ‧ 離線運行
echo ========================================================================
echo.
echo 提示：若您不想看黑底命令視窗，也可以直接雙擊「單機版_直接點開免安裝.html」！
echo 正在本機啟動離線網頁服務，請勿關閉此視窗...
echo 系統將在 2 秒後自動於瀏覽器中開啟：http://localhost:3000
echo.

REM 延遲 1.5 秒自動開啟預設瀏覽器
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

REM 嘗試使用 Python (如果有安裝)
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [模式] 偵測到 Python，使用 Python 離線伺服器 (Port: 3000)...
    python -m http.server 3000 --bind 127.0.0.1
    goto END
)

where python3 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [模式] 偵測到 Python3，使用 Python3 離線伺服器 (Port: 3000)...
    python3 -m http.server 3000 --bind 127.0.0.1
    goto END
)

REM 嘗試使用 Node / npx (如果有安裝)
where npx >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [模式] 偵測到 Node.js，使用 npx 伺服器 (Port: 3000)...
    npx --yes serve -p 3000 .
    goto END
)

REM 免安裝模式：使用 Windows 內建 PowerShell HTTP 服務 (無需安裝任何額外軟體)
echo [模式] 使用 Windows 內建 PowerShell 本機服務 (無需安裝任何軟體)...
powershell -ExecutionPolicy Bypass -NoProfile -Command ^
    "$listener = New-Object System.Net.HttpListener; ^
    $listener.Prefixes.Add('http://localhost:3000/'); ^
    try { $listener.Start() } catch { Write-Host '連接埠 3000 佔用中，請先關閉其他程式'; exit }; ^
    Write-Host '系統已就緒！請在瀏覽器操作。欲關閉系統，直接關閉本黑底命令視窗即可。'; ^
    while ($listener.IsListening) { ^
        $context = $listener.GetContext(); ^
        $request = $context.Request; ^
        $response = $context.Response; ^
        $localPath = $request.Url.LocalPath; ^
        if ($localPath -eq '/') { $localPath = '/index.html' }; ^
        $filePath = Join-Path (Get-Location).Path $localPath.TrimStart('/').Replace('/', '\'); ^
        if (Test-Path -Path $filePath -PathType Leaf) { ^
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower(); ^
            switch ($ext) { ^
                '.html' { $response.ContentType = 'text/html; charset=utf-8' } ^
                '.js'   { $response.ContentType = 'application/javascript; charset=utf-8' } ^
                '.css'  { $response.ContentType = 'text/css; charset=utf-8' } ^
                '.json' { $response.ContentType = 'application/json; charset=utf-8' } ^
                '.png'  { $response.ContentType = 'image/png' } ^
                '.jpg'  { $response.ContentType = 'image/jpeg' } ^
                '.svg'  { $response.ContentType = 'image/svg+xml' } ^
                default { $response.ContentType = 'application/octet-stream' } ^
            }; ^
            $bytes = [System.IO.File]::ReadAllBytes($filePath); ^
            $response.ContentLength64 = $bytes.Length; ^
            $response.OutputStream.Write($bytes, 0, $bytes.Length); ^
        } else { ^
            $response.StatusCode = 404; ^
        }; ^
        $response.Close(); ^
    }"

:END
pause
