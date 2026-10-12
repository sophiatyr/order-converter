@echo off
chcp 65001 >nul
cd /d "%~dp0"
node scripts\update-csq-references.mjs
if errorlevel 1 echo 更新失敗，請確認已安裝 Node.js，且參考檔案可以讀取。
pause
