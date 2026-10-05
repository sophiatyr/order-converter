import React, { useState, useEffect } from 'react';
import { HeaderNav } from './components/HeaderNav';
import { ProformaInvoiceView } from './components/ProformaInvoiceView';
import { FactoryPOView } from './components/FactoryPOView';
import { MappingInspector } from './components/MappingInspector';
import { OrderEditor } from './components/OrderEditor';
import { MappingGuideModal } from './components/MappingGuideModal';
import { PdfUploadModal } from './components/PdfUploadModal';
import { ProductDatabaseModal } from './components/ProductDatabaseModal';
import { SimpleProductExportModal } from './components/SimpleProductExportModal';
import { StandaloneInfoModal } from './components/StandaloneInfoModal';
import { sampleSingleColorOrder, samplePrepackOrder } from './data/sampleOrders';
import { OrderData } from './types/order';
import { ProductMappingItem } from './types/database';
import { exportSimpleProductExcel } from './utils/excelExport';
import {
  FileSpreadsheet,
  Factory,
  Layers,
  Edit3,
  CheckCircle2,
  BookOpen,
  Database,
  Upload,
  AlertCircle,
  Package,
  Monitor,
  Table,
  Download,
} from 'lucide-react';

const SAVED_ORDER_STORAGE_KEY = 'SK_SAVED_UPLOADED_ORDER';

export default function App() {
  // 記住使用者上傳的自訂訂單，避免切換案例或監視模式時跳掉遺失
  const [uploadedOrder, setUploadedOrder] = useState<OrderData | null>(() => {
    try {
      const saved = localStorage.getItem(SAVED_ORDER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.poNumber) return parsed;
      }
    } catch (e) {
      console.error('Error restoring uploaded order', e);
    }
    return null;
  });

  const [currentOrder, setCurrentOrder] = useState<OrderData>(() => {
    return uploadedOrder || samplePrepackOrder;
  });

  const [activeSampleType, setActiveSampleType] = useState<'normal' | 'multiple' | 'custom'>(() => {
    return uploadedOrder ? 'custom' : 'multiple';
  });

  const [activeTab, setActiveTab] = useState<'factory' | 'pi' | 'mapping' | 'editor'>('factory');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDatabaseOpen, setIsDatabaseOpen] = useState(false);
  const [isSimpleExportOpen, setIsSimpleExportOpen] = useState(false);
  const [isStandaloneInfoOpen, setIsStandaloneInfoOpen] = useState(false);

  // PWA Desktop install prompt detection
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setIsStandaloneInfoOpen(true);
    }
  };

  // 切換展示範例（切換時保留上傳訂單，絕不清除）
  const handleSelectSample = (type: 'normal' | 'multiple') => {
    setActiveSampleType(type);
    if (type === 'normal') {
      setCurrentOrder(sampleSingleColorOrder);
    } else {
      setCurrentOrder(samplePrepackOrder);
    }
  };

  // 切換回使用者上傳的訂單
  const handleSelectUploadedOrder = () => {
    if (uploadedOrder) {
      setCurrentOrder(uploadedOrder);
      setActiveSampleType('custom');
    }
  };

  // 切換包裝監視模式 (Normal Pack ⟷ Multiple Pack)
  // 特別注意：不能因為使用者切換 normal pack 或 multiple pack 監視，上傳的檔案就跳掉了！
  const handleTogglePackingMonitoring = (targetType: 'normal' | 'multiple') => {
    const isMultiple = targetType === 'multiple';
    const newPackingType = isMultiple ? 'MULTIPLE PACK' : 'NORMAL PACK';
    const newOrderType = isMultiple
      ? 'prepack_kit'
      : currentOrder.items.length > 1
      ? 'multi_color'
      : 'single_color';

    const updated: OrderData = {
      ...currentOrder,
      packingType: newPackingType,
      orderType: newOrderType,
      items: currentOrder.items.map((it) => ({
        ...it,
        isPrepack: isMultiple,
      })),
    };

    setCurrentOrder(updated);

    // 若當前正檢視上傳訂單，同步更新儲存的狀態與 localStorage
    if (
      activeSampleType === 'custom' ||
      (uploadedOrder && currentOrder.poNumber === uploadedOrder.poNumber)
    ) {
      setUploadedOrder(updated);
      try {
        localStorage.setItem(SAVED_ORDER_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
    }
  };

  // 當使用者完成上傳新訂單（PDF / Excel / 文字）
  const handleCustomOrderLoaded = (newOrder: OrderData) => {
    setUploadedOrder(newOrder);
    setCurrentOrder(newOrder);
    setActiveSampleType('custom');
    setActiveTab('factory'); // 自動切至工廠中文採購單，方便核對反紅欄位與線上微調

    try {
      localStorage.setItem(SAVED_ORDER_STORAGE_KEY, JSON.stringify(newOrder));
    } catch (e) {
      console.error('Error saving uploaded order to localStorage', e);
    }
  };

  // 統一訂單更新（線上微調、品名面料單價編輯等）
  const handleUpdateOrder = (updatedOrder: OrderData) => {
    setCurrentOrder(updatedOrder);
    if (
      activeSampleType === 'custom' ||
      (uploadedOrder && updatedOrder.poNumber === uploadedOrder.poNumber)
    ) {
      setUploadedOrder(updatedOrder);
      try {
        localStorage.setItem(SAVED_ORDER_STORAGE_KEY, JSON.stringify(updatedOrder));
      } catch (e) {}
    }
  };

  // 當從中英文對照庫套用更新至當前訂單
  const handleApplyDatabaseToOrder = (matchedItems: ProductMappingItem[]) => {
    const map = new Map(matchedItems.map((m) => [m.itemNo, m]));
    let matchedSupplier = currentOrder.factorySupplier;

    const updatedItems = currentOrder.items.map((item) => {
      const match = map.get(item.itemNo);
      if (match) {
        if (match.factorySupplier) {
          matchedSupplier = match.factorySupplier;
        }
        const unitRMB =
          match.factoryCurrency === 'RMB'
            ? match.factoryPrice
            : match.unitPriceRMB || item.unitPriceRMB;
        const unitUSD =
          match.factoryCurrency === 'USD'
            ? match.factoryPrice
            : match.customerPriceUSD || match.unitPriceUSD || item.unitPriceUSD;

        return {
          ...item,
          chineseName: match.chineseName || item.chineseName,
          chineseSpec: match.chineseSpec || item.chineseSpec,
          unitPriceRMB: unitRMB > 0 ? unitRMB : item.unitPriceRMB,
          unitPriceUSD: unitUSD > 0 ? unitUSD : item.unitPriceUSD,
        };
      }
      return item;
    });

    const updatedOrder = {
      ...currentOrder,
      factorySupplier: matchedSupplier,
      items: updatedItems,
    };

    handleUpdateOrder(updatedOrder);
  };

  const isCurrentMultiple =
    currentOrder.packingType === 'MULTIPLE PACK' ||
    currentOrder.orderType === 'prepack_kit' ||
    currentOrder.items.some((it) => it.isPrepack);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* Top Navbar */}
      <HeaderNav
        currentOrder={currentOrder}
        activeSampleType={activeSampleType}
        uploadedOrder={uploadedOrder}
        onSelectSample={handleSelectSample}
        onSelectUploadedOrder={handleSelectUploadedOrder}
        onTogglePackingMonitoring={handleTogglePackingMonitoring}
        onOpenMappingGuide={() => setIsGuideOpen(true)}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenDatabase={() => setIsDatabaseOpen(true)}
        onOpenSimpleExport={() => setIsSimpleExportOpen(true)}
        onOpenStandaloneInfo={() => setIsStandaloneInfoOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Verification & Welcome Banner */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-blue-600">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-400/20 text-emerald-300 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                </span>
                <h1 className="font-extrabold text-base sm:text-lg tracking-tight flex items-center gap-2">
                  <span>外貿成衣訂單轉換系統</span>
                  <span className="text-xs bg-emerald-400 text-slate-950 font-black px-2 py-0.5 rounded-full">
                    單機版
                  </span>
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-blue-100 leading-relaxed max-w-4xl">
                已完整遵循您的採購單規範：
                <span className="font-bold text-white underline decoration-emerald-400 mx-1">
                  新增 5 欄簡易產品清單 Excel (產品編號/數量/金額)
                </span>
                、
                <span className="font-bold text-white underline decoration-emerald-400 mx-1">
                  支援電腦桌面單機版安裝與離線運行
                </span>
                、
                <span className="font-bold text-white underline decoration-emerald-400 mx-1">
                  自動分析 Normal/Multiple Pack
                </span>
                與
                <span className="font-bold text-white underline decoration-emerald-400 mx-1">
                  缺工廠資料單價字體反紅・線上微調
                </span>
                。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* 導出 5 欄簡易產品清單 Excel 快捷鍵 */}
              <button
                onClick={() => setIsSimpleExportOpen(true)}
                className="px-3.5 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5"
                title="預覽與導出 5 欄產品清單 Excel"
              >
                <Table className="w-3.5 h-3.5 text-slate-950" />
                導出 5 欄產品清單
              </button>

              {/* 桌面單機版安裝 */}
              <button
                onClick={handleInstallApp}
                className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5 border border-white/20"
                title="查看單機版離線使用手冊或安裝至電腦桌面"
              >
                <Monitor className="w-3.5 h-3.5 text-sky-200" />
                單機版說明
              </button>

              <button
                onClick={() => setIsUploadOpen(true)}
                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                上傳客戶原始 PO
              </button>
              <button
                onClick={() => setIsDatabaseOpen(true)}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5"
              >
                <Database className="w-3.5 h-3.5 text-slate-950" />
                產品對照庫
              </button>
            </div>
          </div>

          {/* Quick preset & Pack monitoring controls */}
          <div className="mt-4 pt-3 border-t border-blue-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* 左側：包裝監視模式切換（不跳掉上傳檔案） */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-blue-200 text-[11px] font-semibold">包裝監視切換:</span>
              <button
                type="button"
                onClick={() => {
                  if (activeSampleType === 'custom') {
                    handleTogglePackingMonitoring('normal');
                  } else {
                    handleSelectSample('normal');
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  !isCurrentMultiple
                    ? 'bg-white text-blue-900 shadow-md ring-2 ring-blue-300'
                    : 'bg-blue-800/60 text-blue-100 hover:bg-blue-800'
                }`}
                title="監視 Normal Pack 一般單碼個別裝袋"
              >
                <Package className="w-3.5 h-3.5 text-blue-600" />
                <span>Normal Pack (一般單碼裝)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (activeSampleType === 'custom') {
                    handleTogglePackingMonitoring('multiple');
                  } else {
                    handleSelectSample('multiple');
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isCurrentMultiple
                    ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-300'
                    : 'bg-purple-900/60 text-purple-200 hover:bg-purple-800'
                }`}
                title="監視 Multiple Pack 單色混碼裝袋"
              >
                <Package className="w-3.5 h-3.5 text-purple-300" />
                <span>Multiple Pack (單色混碼裝袋)</span>
              </button>
            </div>

            {/* 右側：目前檢視狀態與上傳檔案一鍵返回 */}
            <div className="flex items-center gap-2 flex-wrap">
              {activeSampleType === 'custom' ? (
                <div className="flex items-center gap-2 bg-emerald-500/30 border border-emerald-400/50 px-3 py-1 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                  <span className="text-emerald-100 font-bold text-xs">
                    正在檢視上傳訂單：{currentOrder.poNumber}（
                    {isCurrentMultiple ? '混碼裝袋' : '單碼裝'}）
                  </span>
                </div>
              ) : uploadedOrder ? (
                <button
                  type="button"
                  onClick={handleSelectUploadedOrder}
                  className="px-3 py-1.5 rounded-lg text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-all flex items-center gap-1.5 shadow-sm"
                  title="隨時返回您已上傳的訂單資料"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>回到上傳訂單 ({uploadedOrder.poNumber})</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('factory')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
              activeTab === 'factory'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200 border-b-transparent'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Factory className="w-4 h-4 text-amber-700" />
            <span>工廠中文採購單 (繁體版)</span>
            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-bold">
              Sheet 2
            </span>
          </button>

          <button
            onClick={() => setActiveTab('pi')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
              activeTab === 'pi'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200 border-b-transparent'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>英文發票 P/I (S/C)</span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
              Sheet 1
            </span>
          </button>

          <button
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
              activeTab === 'editor'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200 border-b-transparent'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Edit3 className="w-4 h-4 text-purple-600" />
            <span>線上微調資料清單</span>
          </button>

          <button
            onClick={() => setActiveTab('mapping')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
              activeTab === 'mapping'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200 border-b-transparent'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>對照表映射解析</span>
          </button>
        </div>

        {/* Tab Content Display */}
        <div>
          {activeTab === 'factory' && (
            <FactoryPOView order={currentOrder} onUpdateOrder={handleUpdateOrder} />
          )}
          {activeTab === 'pi' && <ProformaInvoiceView order={currentOrder} />}
          {activeTab === 'mapping' && (
            <MappingInspector order={currentOrder} activeSampleType={activeSampleType} />
          )}
          {activeTab === 'editor' && (
            <OrderEditor order={currentOrder} onChange={handleUpdateOrder} />
          )}
        </div>
      </main>

      {/* Modals */}
      <ProductDatabaseModal
        isOpen={isDatabaseOpen}
        onClose={() => setIsDatabaseOpen(false)}
        onApplyToOrder={handleApplyDatabaseToOrder}
      />
      <MappingGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      <PdfUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onOrderLoaded={handleCustomOrderLoaded}
      />
      <SimpleProductExportModal
        isOpen={isSimpleExportOpen}
        onClose={() => setIsSimpleExportOpen(false)}
        order={currentOrder}
      />
      <StandaloneInfoModal
        isOpen={isStandaloneInfoOpen}
        onClose={() => setIsStandaloneInfoOpen(false)}
        deferredPrompt={deferredPrompt}
        onInstallApp={handleInstallApp}
      />
    </div>
  );
}
