@echo off
chcp 65001 >nul
title 成衣訂單轉換系統 - 8888
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local.ps1"
if errorlevel 1 pause
