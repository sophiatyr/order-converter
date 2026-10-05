# 外貿成衣訂單轉換與管理系統 (Apparel Export Order & P/I Converter)

一套專為成衣外貿公司、成衣貿易商與成衣工廠量身打造的專業訂單轉換系統。支援客人的原始訂單（PO）快速判讀，並一鍵自動產出對外正式英文形式發票（Proforma Invoice, P/I）以及對內工廠採購單（Excel）。

---

## ✨ 核心特色與功能亮點

### 1. 0-API 純本機離線 PO 判讀引擎
- **100% 本機瀏覽器運算**：免聯網、不呼叫外部付費 API、完全保障客戶商業報價與款式機密。
- **多元輸入格式**：支援 Excel (`.xlsx`, `.xls`)、CSV 與剪貼簿純文字快速貼上解析。
- **智慧欄位偵測**：自動辨識客人的 PO 號碼、買方名稱、款式編號（Style / Item No.）、品名、顏色（Color Code / Color Name）、尺碼、配比（Prepack Ratio）與數量。

### 2. 獨立 2 個專業 Excel 檔案導出
- **分檔輸出**：P/I 與採購單分開為 2 個獨立的 Excel 檔案下載，非擠在同一檔案的 Sheet1 與 Sheet2。
  - `PI_[訂單編號].xlsx`：標準國際貿易英文形式發票（Proforma Invoice），包含賣買雙方資訊、條款、裝運港口、COLOR(1) 顏色組合與尺碼數量配比矩陣。
  - `採購單_[訂單編號].xlsx`：專業工廠採購單，支援人民幣/美金切換、定金比例設定、總數版與混碼裝袋明細版。
- **5 欄清單導出**：提供符合指定格式的「產品編號/客戶產品編號/數量/金額/組合數量」對帳 Excel。

### 3. 多規格與混碼包裝（Prepack Ratio）矩陣計算
- 支援單色單碼、混色混碼（Assorted / Multi-pack）裝箱明細。
- 自動計算大貨總件數、每箱袋裝規格與總金額（英文大寫金額自動轉譯）。

### 4. 雙模式單機免安裝版
- **單一 HTML 檔即開即用**：內建所有樣式、圖示與 SheetJS / ExcelJS 引擎，雙擊即可在 Chrome / Edge 瀏覽器離線秒開。
- **完整離線部署包**：提供 Windows 雙擊啟動腳本 (`.bat`) 與離線手冊。

---

## 🛠️ 技術棧

- **前端框架**：React 19, TypeScript, Vite
- **樣式庫**：Tailwind CSS, Lucide React
- **Excel 處理**：ExcelJS, SheetJS (XLSX)
- **單機離線架構**：純前端離線計算 + Vite Singlefile 打包

---

## 🚀 快速開始

### 本地開發

```bash
# 1. 安裝依賴套件
npm install

# 2. 啟動本機開發伺服器
npm run dev
```

開啟瀏覽器前往 `http://localhost:3000` 即可預覽。

### 專案編譯與單機版打包

```bash
# 編譯生產環境檔案
npm run build

# 產生單機免安裝 HTML 與離線 ZIP 包
python3 scripts/pack_offline.py
```

打包完成後：
- `dist/單機版_直接點開免安裝.html`：可直接傳送給同事雙擊開啟。
- `外貿成衣訂單轉換系統_單機離線完整包.zip`：包含啟動腳本與說明文件的離線壓縮包。

---

## 📂 專案架構

```
├── public/                 # 靜態資源與離線包
├── scripts/                # 離線打包腳本 (pack_offline.py)
├── src/
│   ├── components/         # React UI 組件
│   │   ├── HeaderNav.tsx           # 頂部導航與導出控制
│   │   ├── OrderEditor.tsx         # 訂單明細與配比編輯器
│   │   ├── PdfUploadModal.tsx      # 訂單上傳與離線解析視窗
│   │   ├── ProformaInvoiceView.tsx # 英文形式發票 (P/I) 預覽
│   │   ├── FactoryPOView.tsx       # 工廠採購單預覽
│   │   ├── ProductDatabaseModal.tsx# 內部產品對照資料庫
│   │   └── StandaloneInfoModal.tsx # 單機版說明與下載彈窗
│   ├── data/               # 預設產品與範例訂單
│   ├── types/              # TypeScript 型別定義 (order.ts, database.ts)
│   └── utils/              # 核心運算與匯出模組
│       ├── localPoParser.ts        # 本機 0-API 離線 PO 解析引擎
│       ├── excelExport.ts          # ExcelJS 專業 P/I 與採購單導出
│       └── productDatabase.ts      # 產品編號對照快取
├── index.html              # HTML 進入點
├── server.ts               # 後端開發中介伺服器
└── vite.config.ts          # Vite 配置
```

---

## 📄 License

MIT License
