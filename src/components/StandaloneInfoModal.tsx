import React from 'react';
import { X, ShieldCheck } from 'lucide-react';
interface Props { isOpen: boolean; onClose: () => void; deferredPrompt?: unknown; onInstallApp?: () => void }
export const StandaloneInfoModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl p-6 max-w-xl w-full space-y-4">
      <div className="flex justify-between items-center"><h2 className="font-bold text-lg">CSQ 工作站使用說明</h2><button aria-label="關閉使用說明" onClick={onClose}><X className="w-5 h-5" /></button></div>
      <p className="text-emerald-800 flex gap-2 items-center"><ShieldCheck className="w-5 h-5" />所有訂單分析都在本機執行，不需要 API 金鑰。</p>
      <ol className="list-decimal pl-5 space-y-2 text-sm">
        <li>在專案資料夾雙擊「啟動訂單系統.bat」，自動開啟 http://localhost:8888。</li>
        <li>上傳 Excel、CSV、PDF 或圖片；掃描頁使用本機中英文 OCR。</li>
        <li>在「訂單作業 → 訂單核對」確認款色、尺碼、單價，再到「訂單文件輸出」匯出 P/I、工廠採購單、數量明細及早見表。</li>
        <li>「訂單追蹤」維護進度、Bulk Status 與面料測試；「出貨作業」從 PO 建立批次，填實際數量與重量後確認。</li>
        <li>「開發管理」保存打樣及報價，「產品資料」可按品牌、季節篩選。「數據管理」分析下單及已確認實際出貨，並下載／合併完整工作站備份。</li>
        <li>系統在背景執行，關閉啟動視窗仍可使用。使用完畢可雙擊「停止訂單系統.bat」；電腦重開機後需再次啟動。</li>
      </ol>
      <p className="text-xs text-slate-500">此電腦需有 Node.js 22 或以上版本。移到另一台電腦時，請保留完整專案資料夾，包含 offline_package、vendor 辨識資料與 scripts。</p>
      <p className="text-xs text-slate-500">資料保存在目前的瀏覽器，換電腦或清除瀏覽器資料前請下載備份。支援 CSQ 基本款色尺碼表格；其他品牌版型和 Kit composition 明細仍需逐版驗證，也可讀取 SK-KPI 保存的 CSQ 解析 JSON。</p>
    </div>
  </div>;
};
