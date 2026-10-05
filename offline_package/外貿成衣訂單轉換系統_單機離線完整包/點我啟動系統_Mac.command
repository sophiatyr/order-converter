#!/bin/bash
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
