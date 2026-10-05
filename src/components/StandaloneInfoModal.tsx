import React, { useState, useEffect } from 'react';
import {
  Monitor,
  Download,
  X,
  CheckCircle2,
  HardDrive,
  WifiOff,
  FileSpreadsheet,
  Package,
  FolderArchive,
  Loader2,
  AlertCircle,
  Sparkles,
  FileCode,
  RefreshCw,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import {
  triggerOfflinePackDownload,
  triggerStandaloneHtmlDownload,
  fetchPackInfo,
  PackInfo,
} from '../utils/downloadHelper';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt?: any;
  onInstallApp?: () => void;
}

export const StandaloneInfoModal: React.FC<Props> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onInstallApp,
}) => {
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [isDownloadingHtml, setIsDownloadingHtml] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean | null>(null);
  const [packInfo, setPackInfo] = useState<PackInfo>({
    zipAvailable: true,
    zipSizeBytes: 1136697,
    zipSizeFormatted: '1.1 MB',
    htmlAvailable: true,
    htmlSizeBytes: 2025223,
    htmlSizeFormatted: '2.0 MB',
  });

  useEffect(() => {
    if (isOpen) {
      fetchPackInfo().then(setPackInfo).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownloadZip = async () => {
    setIsDownloadingZip(true);
    setDownloadMsg(`正在準備並下載完整離線 ZIP 包 (${packInfo.zipSizeFormatted})...`);
    setDownloadSuccess(null);

    await triggerOfflinePackDownload((status) => {
      setIsDownloadingZip(status.loading);
      setDownloadMsg(status.message);
      if (status.success !== undefined) {
        setDownloadSuccess(status.success);
      }
      if (!status.loading && status.success) {
        setTimeout(() => setDownloadMsg(null), 8000);
      }
    });
  };

  const handleDownloadHtml = async () => {
    setIsDownloadingHtml(true);
    setDownloadMsg(`正在下載免解壓單一 HTML 檔 (${packInfo.htmlSizeFormatted})...`);
    setDownloadSuccess(null);

    await triggerStandaloneHtmlDownload((status) => {
      setIsDownloadingHtml(status.loading);
      setDownloadMsg(status.message);
      if (status.success !== undefined) {
        setDownloadSuccess(status.success);
      }
      if (!status.loading && status.success) {
        setTimeout(() => setDownloadMsg(null), 8000);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-indigo-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/30 text-indigo-300 rounded-xl border border-indigo-500/40">
              <Package className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-wide">
                  離線單機版打包與下載中心
                </h2>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  100% 離線可用
                </span>
              </div>
              <p className="text-xs text-slate-300">
                可下載完整 ZIP 包或單一 HTML 檔給同事，雙擊即用，無需連網
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs text-slate-700 overflow-y-auto">
          {/* 10.1 KB 舊版問題說明與修正通知 */}
          <div className="bg-amber-50 border border-amber-300/80 rounded-xl p-3.5 flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-[11px] text-amber-900 leading-relaxed">
              <div className="font-bold text-amber-950 flex items-center gap-1.5">
                <span>⚠️ 為什麼先前下載只有 10.1 KB 且裡面沒有東西？</span>
                <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.2 rounded font-bold">
                  已全面修正
                </span>
              </div>
              <p>
                <strong>原因說明：</strong>前一版打包腳本僅封裝了啟動批次檔與說明文字（約 10.1 KB），未將前端運算與頁面程式碼完整內嵌進去，導致同事解壓後找不到主程式。
              </p>
              <p className="text-emerald-800 font-semibold">
                <strong>現已完成修正：</strong>最新打包已將完整的離線成衣訂單轉換核心、Excel 報表引擎全部封裝完畢（完整包實際大小為 <strong>{packInfo.zipSizeFormatted}</strong>，單一網頁版為 <strong>{packInfo.htmlSizeFormatted}</strong>）。若您手邊是 10.1 KB 的舊檔，請點擊下方按鈕重新下載即可！
              </p>
            </div>
          </div>

          {/* 下載狀態反饋 */}
          {downloadMsg && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 font-medium transition-all ${
                downloadSuccess === true
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-sm'
                  : downloadSuccess === false
                  ? 'bg-rose-50 border-rose-400 text-rose-900 shadow-sm'
                  : 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-sm'
              }`}
            >
              {downloadSuccess === true ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : downloadSuccess === false ? (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              ) : (
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600 shrink-0" />
              )}
              <span className="flex-1">{downloadMsg}</span>
            </div>
          )}

          {/* 兩種最推薦的下載方式 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 下載方式 A: 單一免安裝 HTML 網頁 (最推薦、最無腦) */}
            <div className="bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-emerald-500/40 shadow-lg flex flex-col justify-between space-y-4">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 rounded-md font-bold text-[10px] flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> 最推薦 ‧ 免解壓縮
                  </span>
                  <span className="text-[11px] font-mono text-emerald-300 font-bold">
                    大小：{packInfo.htmlSizeFormatted}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-emerald-400" />
                    單一免安裝網頁 (.html)
                  </h3>
                  <p className="text-[11px] text-emerald-200 mt-1 leading-snug">
                    一個獨立檔案包含所有功能！傳給同事後，<strong>完全不用解壓縮</strong>，直接用 Chrome 或 Edge 雙擊秒開！
                  </p>
                </div>
                <ul className="space-y-1.5 text-[11px] text-emerald-100/90 pt-1">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>免安裝 Python、Node.js 或任何環境</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>拔掉網路線、無外網環境 100% 離線正常操作</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>P/I、採購單與 5 欄產品清單皆可離線導出</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={handleDownloadHtml}
                disabled={isDownloadingHtml || isDownloadingZip}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all cursor-pointer disabled:opacity-60"
              >
                {isDownloadingHtml ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>
                  {isDownloadingHtml
                    ? '正在下載單一 HTML...'
                    : `下載單一免安裝 HTML (${packInfo.htmlSizeFormatted})`}
                </span>
              </button>
            </div>

            {/* 下載方式 B: 完整離線 ZIP 包 (含雙擊 bat 與 command) */}
            <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white p-4 sm:p-5 rounded-2xl border border-indigo-500/40 shadow-lg flex flex-col justify-between space-y-4">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 rounded-md font-bold text-[10px] flex items-center gap-1">
                    <FolderArchive className="w-3 h-3" /> 完整打包 ‧ 雙擊啟動
                  </span>
                  <span className="text-[11px] font-mono text-indigo-300 font-bold">
                    大小：{packInfo.zipSizeFormatted}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                    <Package className="w-4 h-4 text-indigo-400" />
                    完整離線安裝包 (.zip)
                  </h3>
                  <p className="text-[11px] text-indigo-200 mt-1 leading-snug">
                    內附 Windows 專用雙擊啟動器 (.bat)、Mac 啟動器與純文字操作指南。
                  </p>
                </div>
                <ul className="space-y-1.5 text-[11px] text-indigo-100/90 pt-1">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>內含「點我啟動系統_Windows.bat」雙擊自動開啟</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>內含繁體中文同事使用手冊 (TXT 與 Markdown)</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>亦包含單機版 HTML，任選一種方式皆可</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={isDownloadingZip || isDownloadingHtml}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all cursor-pointer disabled:opacity-60"
              >
                {isDownloadingZip ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>
                  {isDownloadingZip
                    ? '正在下載完整 ZIP...'
                    : `下載完整離線 ZIP 包 (${packInfo.zipSizeFormatted})`}
                </span>
              </button>
            </div>
          </div>

          {/* Section 1: 一鍵安裝為電腦桌面應用 (PWA) */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-4 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-600 text-white rounded-lg">
                  <Monitor className="w-4 h-4" />
                </span>
                <span className="font-extrabold text-blue-950 text-sm">
                  方法三：安裝為電腦桌面獨立視窗應用 (PWA)
                </span>
              </div>
              {deferredPrompt && (
                <button
                  type="button"
                  onClick={onInstallApp}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  安裝至桌面
                </button>
              )}
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              本系統已完全支援 <strong>Progressive Web App (PWA)</strong> 桌面單機版規範。安裝後將在桌面與開始功能表建立專屬圖示，點開即為<strong>無網址列、無瀏覽器干擾的純獨立視窗軟體</strong>，操作體驗如同原生軟體！
            </p>
          </div>

          {/* Section 2: 離線 100% 支援能力 */}
          <div className="space-y-2.5">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-emerald-600" />
              離線與單機版功能支援一覽
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  Excel 報表 100% 本機生成
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  英文 P/I、工廠採購單與 5 欄簡易產品清單均由本機瀏覽器核心（ExcelJS）直接運算生成，<strong>即使拔掉網路線也能正常導出下載！</strong>
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                  產品對照資料庫本地保存
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  中英文品名、面料規格、工廠名稱與單價儲存於您電腦本機 LocalStorage，<strong>資料絕不外流，安全保密性極高</strong>。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <span>外貿成衣訂單轉換系統・單機離線完整版</span>
            <span className="text-slate-300">|</span>
            <span className="font-mono text-slate-600">ZIP: {packInfo.zipSizeFormatted}</span>
            <span className="text-slate-300">|</span>
            <span className="font-mono text-slate-600">HTML: {packInfo.htmlSizeFormatted}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-all shadow-sm cursor-pointer"
            >
              關閉視窗
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
