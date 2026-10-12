import React, { useState } from 'react';
import {
  FileSpreadsheet,
  BookOpen,
  Upload,
  Download,
  Database,
  Layers,
  CheckCircle2,
  Package,
  Monitor,
  Table,
  Loader2,
} from 'lucide-react';
import { OrderData } from '../types/order';
import { exportOrderToExcel, exportSimpleProductExcel } from '../utils/excelExport';
import { triggerOfflinePackDownload } from '../utils/downloadHelper';

interface Props {
  currentOrder: OrderData;
  activeSampleType: 'normal' | 'multiple' | 'custom';
  uploadedOrder: OrderData | null;
  onSelectSample: (type: 'normal' | 'multiple') => void;
  onSelectUploadedOrder: () => void;
  onTogglePackingMonitoring: (type: 'normal' | 'multiple') => void;
  onOpenMappingGuide: () => void;
  onOpenUpload: () => void;
  onOpenDatabase: () => void;
  onOpenSimpleExport: () => void;
  onOpenStandaloneInfo: () => void;
}

export const HeaderNav: React.FC<Props> = ({
  currentOrder,
  activeSampleType,
  uploadedOrder,
  onSelectSample,
  onSelectUploadedOrder,
  onTogglePackingMonitoring,
  onOpenMappingGuide,
  onOpenUpload,
  onOpenDatabase,
  onOpenSimpleExport,
  onOpenStandaloneInfo,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const handleDownloadPack = async () => {
    setIsDownloading(true);
    await triggerOfflinePackDownload((status) => {
      setIsDownloading(status.loading);
      setDownloadNotice(status.message);
      if (!status.loading) {
        setTimeout(() => setDownloadNotice(null), 4000);
      }
    });
  };

  const currentPackingType =
    currentOrder.packingType === 'MULTIPLE PACK' ||
    currentOrder.orderType === 'prepack_kit' ||
    currentOrder.items.some((it) => it.isPrepack)
      ? 'multiple'
      : 'normal';

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Title */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl shadow-inner">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                  成衣訂單轉換系統
                </span>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  單機版
                </span>
                <span className="hidden sm:inline-block text-[11px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono">
                  繁體中文
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden lg:block">
                P/I 與工廠採購單生成・5欄簡易產品清單 Excel・離線單機版運行
              </p>
            </div>
          </div>

          {/* Quick preset selector & Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* 上傳的訂單按鈕 (若有上傳訂單，始終保留並可一鍵返回，絕不消失) */}
            {uploadedOrder && (
              <button
                type="button"
                onClick={onSelectUploadedOrder}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                  activeSampleType === 'custom'
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-300 shadow-md'
                    : 'bg-slate-800 text-emerald-300 hover:bg-slate-700 border border-emerald-500/40'
                }`}
                title={`返回您上傳的原始訂單 ${uploadedOrder.poNumber}，資料已妥善保存`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                <span className="hidden sm:inline">上傳訂單:</span>
                <span>{uploadedOrder.poNumber}</span>
              </button>
            )}

            {/* 包裝模式監視切換 (Normal Pack ⟷ Multiple Pack) */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => {
                  if (activeSampleType === 'custom') {
                    onTogglePackingMonitoring('normal');
                  } else {
                    onSelectSample('normal');
                  }
                }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-bold transition-all ${
                  currentPackingType === 'normal'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
                title="切換監視為 Normal Pack (一般單碼個別裝袋)"
              >
                Normal Pack (單碼裝)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (activeSampleType === 'custom') {
                    onTogglePackingMonitoring('multiple');
                  } else {
                    onSelectSample('multiple');
                  }
                }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-bold transition-all ${
                  currentPackingType === 'multiple'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-purple-300 hover:text-white hover:bg-slate-700/50'
                }`}
                title="切換監視為 Multiple Pack (單色混碼裝袋)"
              >
                Multiple Pack (混碼裝袋)
              </button>
            </div>

            {/* 產品中英文對照資料庫按鈕 */}
            <button
              onClick={onOpenDatabase}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-amber-300 hover:text-amber-200 transition-all shadow-sm"
              title="管理品名、面料、單價中英文對照資料庫"
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>產品對照庫</span>
            </button>

            {/* Upload Button */}
            <button
              onClick={onOpenUpload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>上傳客戶PO</span>
            </button>

            {/* 導出 5 欄產品清單 Excel 按鈕 (產品編號/客戶產品編號/數量/金額/組合數量) */}
            <button
              onClick={onOpenSimpleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-xs font-bold text-white transition-all shadow-sm active:scale-95"
              title="導出指定 5 欄格式 Excel (產品編號 / 客戶產品編號 / 數量 / 金額 / 組合數量)"
            >
              <Table className="w-3.5 h-3.5 text-teal-200" />
              <span className="hidden sm:inline">5欄產品清單</span>
              <span>Excel</span>
            </button>

            {/* Export P/I & PO Excel Button (分開2個檔案下載) */}
            <button
              onClick={() => exportOrderToExcel(currentOrder)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-bold text-white transition-all shadow-md active:scale-95 cursor-pointer"
              title="分開導出 2 個獨立 Excel 檔案：英文 P/I 檔與工廠採購單檔 (絕不放在同一檔案之 Sheet1/Sheet2)"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">導出 P/I & 採購單</span>
              <span className="sm:hidden">導出兩檔</span>
              <span className="text-[10px] bg-emerald-800/80 text-emerald-200 px-1 py-0.2 rounded font-mono">
                分開2檔
              </span>
            </button>

            {/* 打包離線檔給同事使用 (ZIP) */}
            <button
              type="button"
              onClick={onOpenStandaloneInfo}
              disabled={isDownloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 border border-indigo-400/40 text-xs font-bold text-white transition-all shadow-sm active:scale-95"
              title="查看新版 PDF／OCR 本機版的啟動方式與使用說明"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-200" />
              ) : (
                <Package className="w-3.5 h-3.5 text-indigo-200" />
              )}
              <span className="hidden lg:inline">{isDownloading ? '下載中...' : '打包'}</span>
              <span>本機使用說明</span>
              <span className="hidden xl:inline text-[10px] bg-indigo-800/80 text-indigo-200 px-1 py-0.2 rounded font-mono">
                8888
              </span>
            </button>

            {/* 單機版與離線運行手冊 / 安裝按鈕 */}
            <button
              onClick={onOpenStandaloneInfo}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-sky-300 hover:text-sky-200 transition-all shadow-sm"
              title="電腦桌面單機版安裝與離線使用手冊"
            >
              <Monitor className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">單機版</span>
            </button>
          </div>
        </div>
      </div>
      {downloadNotice && (
        <div className="bg-indigo-600 text-white text-xs py-1.5 px-4 text-center font-bold animate-fade-in shadow-inner flex items-center justify-center gap-2">
          <span>{downloadNotice}</span>
        </div>
      )}
    </header>
  );
};
