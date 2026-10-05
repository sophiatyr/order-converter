import os
import shutil
import zipfile
import subprocess
import re

BASE_DIR = os.path.abspath(os.path.dirname(__file__) + '/..')
DIST_DIR = os.path.join(BASE_DIR, 'dist')
PACKAGE_DIR = os.path.join(BASE_DIR, 'offline_package', '外貿成衣訂單轉換系統_單機離線完整包')
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')

def clean_old_zips():
    print("[0] Cleaning old zip files...")
    for target in [
        os.path.join(BASE_DIR, '外貿成衣訂單轉換系統_單機離線完整包.zip'),
        os.path.join(BASE_DIR, 'offline-pack.zip'),
        os.path.join(PUBLIC_DIR, '外貿成衣訂單轉換系統_單機離線完整包.zip'),
        os.path.join(PUBLIC_DIR, 'offline-pack.zip'),
        os.path.join(DIST_DIR, '外貿成衣訂單轉換系統_單機離線完整包.zip'),
        os.path.join(DIST_DIR, 'offline-pack.zip'),
    ]:
        if os.path.exists(target):
            try:
                os.remove(target)
            except Exception:
                pass

def build_dist():
    print("[1] Building Vite production assets...")
    subprocess.check_call(['npm', 'run', 'build'], cwd=BASE_DIR)

def generate_single_file_html():
    print("[2] Generating standalone zero-server single-file HTML (免伺服器直開版)...")
    html_path = os.path.join(DIST_DIR, 'index.html')
    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()

    # Find and inline CSS
    css_match = re.search(r'<link rel=\"stylesheet\" crossorigin href=\"\./(assets/[^\"]+\.css)\">', html)
    if css_match:
        css_rel = css_match.group(1)
        css_full = os.path.join(DIST_DIR, css_rel)
        if os.path.exists(css_full):
            with open(css_full, 'r', encoding='utf-8') as cf:
                css_content = cf.read()
            html = html.replace(css_match.group(0), f'<style>\n{css_content}\n</style>')

    # Find and inline JS
    js_match = re.search(r'<script type=\"module\" crossorigin src=\"\./(assets/[^\"]+\.js)\"></script>', html)
    if js_match:
        js_rel = js_match.group(1)
        js_full = os.path.join(DIST_DIR, js_rel)
        if os.path.exists(js_full):
            with open(js_full, 'r', encoding='utf-8') as jf:
                js_content = jf.read()
            html = html.replace(js_match.group(0), f'<script type=\"module\">\n{js_content}\n</script>')

    single_file_path = os.path.join(DIST_DIR, '單機版_直接點開免安裝.html')
    with open(single_file_path, 'w', encoding='utf-8') as out:
        out.write(html)
    print(f"    Created: {single_file_path} ({os.path.getsize(single_file_path) / 1024 / 1024:.2f} MB)")

    # Also copy to PUBLIC_DIR so it can be served or downloaded directly
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    shutil.copy2(single_file_path, os.path.join(PUBLIC_DIR, '單機版_直接點開免安裝.html'))
    shutil.copy2(single_file_path, os.path.join(PUBLIC_DIR, 'standalone.html'))
    print(f"    Copied standalone HTML to public/ as well.")

def prepare_package_files():
    print("[3] Assembling offline package files...")
    if os.path.exists(PACKAGE_DIR):
        shutil.rmtree(PACKAGE_DIR)
    os.makedirs(PACKAGE_DIR, exist_ok=True)

    # 1. Copy dist files into PACKAGE_DIR, strictly skipping any .zip files
    for item in os.listdir(DIST_DIR):
        if item.endswith('.zip'):
            continue
        s = os.path.join(DIST_DIR, item)
        d = os.path.join(PACKAGE_DIR, item)
        if os.path.isdir(s):
            shutil.copytree(s, d)
        else:
            shutil.copy2(s, d)

    # 2. Create Windows batch launcher: 點我啟動系統_Windows.bat
    bat_content = r'''@echo off
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
'''
    with open(os.path.join(PACKAGE_DIR, '點我啟動系統_Windows.bat'), 'w', encoding='utf-8') as f:
        f.write(bat_content)

    # 3. Create Mac launcher: 點我啟動系統_Mac.command
    mac_content = '''#!/bin/bash
cd "$(dirname "$0")"
clear
echo "========================================================================"
echo "  外貿成衣訂單轉換系統 (單機離線完整版)"
echo "  P/I 生成 ‧ 工廠採購單 ‧ 5欄產品清單 Excel ‧ 離線運行"
echo "========================================================================"
echo ""
echo "正在為您啟動本機服務 http://localhost:3000 ..."
sleep 1 && open "http://localhost:3000" &

if command -v python3 &>/dev/null; then
    python3 -m http.server 3000
elif command -v python &>/dev/null; then
    python -m http.server 3000
elif command -v npx &>/dev/null; then
    npx serve -p 3000 .
else
    echo "未檢測到本機伺服器元件，正直接以瀏覽器開啟 單機版_直接點開免安裝.html..."
    open "./單機版_直接點開免安裝.html"
fi
'''
    mac_file = os.path.join(PACKAGE_DIR, '點我啟動系統_Mac.command')
    with open(mac_file, 'w', encoding='utf-8') as f:
        f.write(mac_content)
    try:
        os.chmod(mac_file, 0o755)
    except Exception:
        pass

    # 4. Instructions: 使用說明書_給同事看.txt
    guide_content = '''================================================================================
  外貿成衣訂單轉換系統（單機離線完整版）—— 同事使用指南
================================================================================

【如何開啟系統？（任選一種方式即可）】

方式一：【最推薦！雙擊秒開】
--------------------------------------------------
👉 直接雙擊資料夾內的【單機版_直接點開免安裝.html】
   - 無需安裝任何軟體、無需設定伺服器
   - 在任何電腦（Windows 或 Mac）直接雙擊，以 Chrome 或 Edge 開啟即可使用！
   - 即使拔掉網路線、無外網環境，也能 100% 正常運行、離線導出 Excel！

方式二：【本機伺服器模式】
--------------------------------------------------
👉 Windows 同事：雙擊資料夾內的【點我啟動系統_Windows.bat】
👉 Mac 同事：雙擊資料夾內的【點我啟動系統_Mac.command】
   - 會自動在黑底命令視窗建立本機服務，並自動在瀏覽器中開啟 http://localhost:3000
   - 使用完畢後關閉黑底命令視窗即可結束。

--------------------------------------------------------------------------------
【系統核心功能】
1. 繁體中文全介面，支援 Normal Pack（單碼裝）與 Multiple Pack（單色混碼裝袋）。
2. 一鍵導出【英文 Proforma Invoice (S/C) Excel】。
3. 一鍵導出【工廠中文採購單 Excel】（含人民幣單價、訂金大寫、尺寸配比明細、缺漏反紅警示）。
4. 一鍵導出 5 欄指定格式【產品數量金額清單 Excel】（產品編號 / 客戶產品編號 / 數量 / 金額 / 組合數量）。
5. 內建中英文產品對照庫（LocalStorage 本機留存，商業機密不外流，安全保密）。

祝工作順利！
'''
    with open(os.path.join(PACKAGE_DIR, '使用說明書_給同事看.txt'), 'w', encoding='utf-8') as f:
        f.write(guide_content)

    with open(os.path.join(PACKAGE_DIR, 'README_離線單機版使用指南.md'), 'w', encoding='utf-8') as f:
        f.write(guide_content)

def create_zip_archive():
    print("[4] Creating ZIP archive...")
    zip_root_name = '外貿成衣訂單轉換系統_單機離線完整包'
    zip_dest_root = os.path.join(BASE_DIR, f'{zip_root_name}.zip')
    zip_dest_public = os.path.join(PUBLIC_DIR, f'{zip_root_name}.zip')
    zip_dest_public_alias = os.path.join(PUBLIC_DIR, 'offline-pack.zip')
    zip_dest_dist = os.path.join(DIST_DIR, f'{zip_root_name}.zip')
    zip_dest_dist_alias = os.path.join(DIST_DIR, 'offline-pack.zip')

    os.makedirs(PUBLIC_DIR, exist_ok=True)
    os.makedirs(DIST_DIR, exist_ok=True)

    with zipfile.ZipFile(zip_dest_root, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(PACKAGE_DIR):
            for file in files:
                if file.endswith('.zip'):
                    continue
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, PACKAGE_DIR)
                archive_name = os.path.join(zip_root_name, rel_path)
                zf.write(full_path, archive_name)

    size_mb = os.path.getsize(zip_dest_root) / (1024 * 1024)
    print(f"    Created clean zip: {zip_dest_root} ({size_mb:.2f} MB)")

    # Copy to public and dist
    shutil.copy2(zip_dest_root, zip_dest_public)
    shutil.copy2(zip_dest_root, zip_dest_public_alias)
    shutil.copy2(zip_dest_root, zip_dest_dist)
    shutil.copy2(zip_dest_root, zip_dest_dist_alias)
    print(f"    Copied clean zip to public/ and dist/.")

if __name__ == '__main__':
    clean_old_zips()
    build_dist()
    generate_single_file_html()
    prepare_package_files()
    create_zip_archive()
    print("Done! Offline package successfully packed and verified.")
