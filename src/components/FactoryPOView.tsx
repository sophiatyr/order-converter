import React, { useState } from 'react';
import { OrderData, OrderItem } from '../types/order';
import { amountToChineseWords } from '../utils/numberToWords';
import {
  Download,
  Factory,
  Package,
  Coins,
  Percent,
  AlertCircle,
  Edit3,
  Check,
  Save,
  HelpCircle,
  Eye,
  ChevronDown,
  ChevronRight,
  Database,
} from 'lucide-react';
import {
  exportOrderToExcel,
  exportSimpleProductExcel,
  exportFactoryPOExcel,
} from '../utils/excelExport';
import { groupColorsByRatio } from '../utils/ratioGrouping';
import { upsertProductInDatabase } from '../utils/productDatabase';

interface Props {
  compact?: boolean;
  order: OrderData;
  highlightedField?: string;
  onFieldClick?: (fieldName: string) => void;
  onUpdateOrder?: (updated: OrderData) => void;
}

export const FactoryPOView: React.FC<Props> = ({
  order,
  highlightedField,
  onFieldClick,
  onUpdateOrder,
  compact = false,
}) => {
  const [currency, setCurrency] = useState<'RMB' | 'USD'>(order.factoryCurrency || 'RMB');

  // 訂金設定：是否支付訂金與百分比
  const [hasDeposit, setHasDeposit] = useState<boolean>(order.hasDeposit ?? false);
  const [depositPercent, setDepositPercent] = useState<number>(order.depositPercent ?? 20);

  // Multiple Pack 工廠採購單版本切換: 'detail' (含混碼裝袋明細) 或 'summary' (顯示總數就好)
  const [multiplePackViewMode, setMultiplePackViewMode] = useState<'detail' | 'summary'>('detail');

  // Normal Pack 尺碼裁剪展開切換
  const [showNormalSizeBreakdown, setShowNormalSizeBreakdown] = useState<boolean>(true);

  // 線上微調編輯模式
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [savedDbTip, setSavedDbTip] = useState<string | null>(null);

  const isPrepackOrder =
    order.packingType === 'MULTIPLE PACK' ||
    order.orderType === 'prepack_kit' ||
    order.items.some((i) => i.isPrepack);

  const totalPieces = order.items.reduce((acc, item) => {
    return acc + (item.totalQuantity || item.colors.reduce((cSum, c) => cSum + c.totalQuantity, 0));
  }, 0);

  const totalAmountRMB = order.items.reduce((acc, item) => {
    const itemQty = item.totalQuantity || item.colors.reduce((cSum, c) => cSum + c.totalQuantity, 0);
    return acc + itemQty * (item.unitPriceRMB || 0);
  }, 0);

  const totalAmountUSD = order.items.reduce((acc, item) => {
    const itemQty = item.totalQuantity || item.colors.reduce((cSum, c) => cSum + c.totalQuantity, 0);
    return acc + itemQty * (item.unitPriceUSD || 0);
  }, 0);

  const activeTotalAmount = currency === 'USD' ? totalAmountUSD : totalAmountRMB;
  const activeCurrencySymbol = currency === 'USD' ? 'USD ' : 'RMB ';
  const quantityUnit=order.factoryQuantityUnit||'件';
  const activeCurrencyUnit = `${currency}/${quantityUnit}`;
  const activeCurrencyLabel = currency === 'USD' ? '(USD)' : '(RMB)';

  // 訂金計算
  const depositAmount = hasDeposit ? (activeTotalAmount * depositPercent) / 100 : 0;

  // 付款方式文字（動態產生含訂金備註）
  const dynamicPaymentTerms = hasDeposit
    ? `1. 下单后支付${depositPercent}%订金(${activeCurrencySymbol}${depositAmount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })})\n2. 出货后备齐重量装箱明细, 请款发票, 我司于收到此份文件後15日内即以T/T支付余下货款.`
    : order.factoryTerms ||
      `出货後備齊重量装箱明细, 请款发票, 产地证予我司, 本公司於收到此份文件後15日即以${
        currency === 'USD' ? '美金' : '人民幣'
      }T/T支付货款.`;

  const chineseAmountWords =
    currency === 'USD'
      ? amountToChineseWords(totalAmountUSD).replace(/人民幣/g, '美金')
      : amountToChineseWords(totalAmountRMB);

  // 供應商與單價缺漏檢查
  const isSupplierMissing =
    !order.factorySupplier ||
    order.factorySupplier.trim() === '' ||
    order.factorySupplier === '待確認' ||
    order.factorySupplier === '未指定工廠';

  // 任何缺少單價的品項
  const missingPriceCount = order.items.filter((it) => {
    const price = currency === 'USD' ? it.unitPriceUSD : it.unitPriceRMB;
    return !price || price <= 0;
  }).length;

  const getHighlightClass = (field: string) => {
    return highlightedField === field
      ? 'bg-amber-100 ring-2 ring-amber-400 font-semibold transition-all duration-200'
      : 'hover:bg-amber-50/60 cursor-pointer transition-colors';
  };

  // 線上微調訂單欄位更新處理
  const handleUpdateField = (field: keyof OrderData, value: any) => {
    if (!onUpdateOrder) return;
    onUpdateOrder({
      ...order,
      [field]: value,
    });
  };

  const handleUpdateItem = (itemIndex: number, updates: Partial<OrderItem>) => {
    if (!onUpdateOrder) return;
    const newItems = [...order.items];
    const target = { ...newItems[itemIndex], ...updates };

    // 重新計算品項總金額
    const qty = target.totalQuantity;
    if (updates.unitPriceRMB !== undefined) {
      target.totalAmountRMB = qty * (Number(updates.unitPriceRMB) || 0);
    }
    if (updates.unitPriceUSD !== undefined) {
      target.totalAmountUSD = qty * (Number(updates.unitPriceUSD) || 0);
    }

    newItems[itemIndex] = target;

    onUpdateOrder({
      ...order,
      items: newItems,
    });
  };

  // 將微調後的品項直接同步存入「中英文對照資料庫」
  const handleSyncItemToDb = (item: OrderItem) => {
    upsertProductInDatabase({
      itemNo: item.itemNo,
      factorySupplier: order.factorySupplier,
      chineseName: item.chineseName,
      chineseSpec: item.chineseSpec,
      styleNameEN: item.styleName,
      specEN: item.description,
      factoryCurrency: currency,
      factoryPrice: currency === 'USD' ? item.unitPriceUSD : item.unitPriceRMB,
    });

    setSavedDbTip(`已將款號 [${item.itemNo}] 成功同步儲存至產品對照庫！`);
    setTimeout(() => setSavedDbTip(null), 3000);
  };

  return (
    <div className="bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden text-slate-800 font-sans">
      {/* 頂部操作工具列 */}
      <div className={`${compact ? 'hidden' : ''} bg-slate-100/90 px-4 sm:px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-2 flex-wrap">
          <Factory className="w-5 h-5 text-amber-700" />
          <span className="font-bold text-slate-800 text-sm tracking-wide">
            工廠採購單 (中文版) - SPORTS KITE 標準格式
          </span>
          {isPrepackOrder ? (
            <span className="text-[11px] bg-purple-100 text-purple-900 font-bold px-2.5 py-0.5 rounded-full border border-purple-300 flex items-center gap-1">
              <Package className="w-3 h-3 text-purple-700" />
              Multiple Pack (單色混碼裝袋)
            </span>
          ) : (
            <span className="text-[11px] bg-emerald-100 text-emerald-900 font-bold px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
              <Package className="w-3 h-3 text-emerald-700" />
              Normal Pack (一般單碼裝)
            </span>
          )}

          {/* 缺少資料反紅提醒標籤 */}
          {(isSupplierMissing || missingPriceCount > 0) && (
            <span className="text-[11px] bg-red-100 text-red-700 font-extrabold px-2.5 py-0.5 rounded-full border border-red-300 flex items-center gap-1 animate-pulse">
              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
              {isSupplierMissing && missingPriceCount > 0
                ? '缺工廠資料與單價（字體已反紅）'
                : isSupplierMissing
                ? '缺工廠名稱資料（字體已反紅）'
                : `有 ${missingPriceCount} 個品項缺工廠單價（字體已反紅）`}
            </span>
          )}
        </div>

        {/* 幣別切換、訂金設定、線上微調與版本切換 */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 線上微調資料按鈕 */}
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-xs ${
              isEditing
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                : 'bg-white text-slate-700 hover:text-blue-700 hover:bg-slate-50 border border-slate-300'
            }`}
            title="開啟線上直接微調工廠名稱、單價、中文品名與面料規格"
          >
            <Edit3 className={`w-3.5 h-3.5 ${isEditing ? 'text-white' : 'text-blue-600'}`} />
            <span>{isEditing ? '✓ 完成線上微調' : '✏️ 線上微調資料'}</span>
          </button>

          {/* Multiple Pack 版本切換: 一種含混碼裝袋明細，一種顯示總數就好 */}
          {isPrepackOrder && (
            <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-purple-300 shadow-xs">
              <span className="text-xs font-bold text-purple-900">採購單版本:</span>
              <div className="inline-flex rounded-md p-0.5 bg-purple-50">
                <button
                  type="button"
                  onClick={() => setMultiplePackViewMode('detail')}
                  className={`px-2.5 py-0.5 rounded text-xs font-bold transition-all ${
                    multiplePackViewMode === 'detail'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'text-purple-800 hover:text-purple-950 hover:bg-purple-100'
                  }`}
                  title="完整列出每袋混碼配比、各顏色實際裁剪件數與尺寸展開"
                >
                  📋 含混碼裝袋明細
                </button>
                <button
                  type="button"
                  onClick={() => setMultiplePackViewMode('summary')}
                  className={`px-2.5 py-0.5 rounded text-xs font-bold transition-all ${
                    multiplePackViewMode === 'summary'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'text-purple-800 hover:text-purple-950 hover:bg-purple-100'
                  }`}
                  title="僅顯示主表商品品名、面料規格、總數、單價與金額，省略混碼展開"
                >
                  📄 顯示總數就好
                </button>
              </div>
            </div>
          )}

          {/* 金額幣別切換 */}
          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-300 shadow-xs">
            <Coins className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-bold text-slate-600">計價:</span>
            <div className="inline-flex rounded-md p-0.5 bg-slate-100">
              <button
                type="button"
                onClick={() => setCurrency('RMB')}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                  currency === 'RMB'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                RMB (¥)
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                  currency === 'USD'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                USD ($)
              </button>
            </div>
          </div>

          {/* 訂金設定切換 */}
          <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-300 shadow-xs text-xs">
            <label className="flex items-center gap-1 font-bold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasDeposit}
                onChange={(e) => setHasDeposit(e.target.checked)}
                className="w-3.5 h-3.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
              />
              支付訂金
            </label>
            {hasDeposit && (
              <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={depositPercent}
                  onChange={(e) =>
                    setDepositPercent(Math.max(1, Math.min(100, Number(e.target.value) || 20)))
                  }
                  className="w-10 px-1 py-0.5 text-center font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded text-xs"
                />
                <span className="font-bold text-slate-600">%</span>
              </div>
            )}
          </div>

          <button
            onClick={() =>
              exportFactoryPOExcel(
                {
                  ...order,
                  hasDeposit,
                  depositPercent,
                  depositAmount,
                  factoryCurrency: currency,
                  factoryTerms: dynamicPaymentTerms,
                },
                undefined,
                { poCurrency: currency, prepackMode: multiplePackViewMode }
              )
            }
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-95 cursor-pointer"
            title={`僅匯出中文工廠採購單 Excel (單一獨立檔案，無工作表1) (${
              multiplePackViewMode === 'summary' ? '僅顯示總數版' : '含混碼裝袋明細版'
            })`}
          >
            <Download className="w-3.5 h-3.5" />
            導出採購單 獨立 Excel
          </button>

          <button
            onClick={() =>
              exportOrderToExcel(
                {
                  ...order,
                  hasDeposit,
                  depositPercent,
                  depositAmount,
                  factoryCurrency: currency,
                  factoryTerms: dynamicPaymentTerms,
                },
                undefined,
                { poCurrency: currency, prepackMode: multiplePackViewMode }
              )
            }
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-95 cursor-pointer"
            title="依序下載 2 個獨立 Excel 檔案 (P/I 檔與採購單檔各 1 個，不放在同檔 Sheet1/Sheet2)"
          >
            <Download className="w-3.5 h-3.5" />
            一鍵導出兩檔 (分開2個Excel)
          </button>

          {/* 導出 5 欄簡易產品清單 Excel (產品編號/客戶產品編號/數量/金額/組合數量) */}
          <button
            type="button"
            onClick={() => exportSimpleProductExcel(order)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-95"
            title="導出指定 5 欄格式 Excel (產品編號 / 客戶產品編號 / 數量 / 金額 / 組合數量)"
          >
            <Download className="w-3.5 h-3.5 text-teal-200" />
            導出產品清單 (5欄格式)
          </button>
        </div>
      </div>

      {/* 線上微調提示列 */}
      {isEditing && (
        <div className="bg-emerald-50 px-6 py-2.5 border-b border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              <strong>正在線上微調資料中：</strong>
              可直接在下方表格修改【工廠名稱】、【單價】、【中文品名】與【面料規格】，系統將即時計算金額，並可一鍵同步儲存至對照庫！
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-md text-xs shrink-0"
          >
            完成微調
          </button>
        </div>
      )}

      {/* 儲存成功提示 */}
      {savedDbTip && (
        <div className="bg-blue-600 text-white px-6 py-2 text-xs font-bold flex items-center justify-between shadow-sm animate-fade-in">
          <span>✓ {savedDbTip}</span>
          <button onClick={() => setSavedDbTip(null)} className="text-white hover:text-blue-200 text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Spreadsheet Container (精確還原原版版型) */}
      <div className="p-6 md:p-8 overflow-x-auto bg-slate-50/50 flex justify-center">
        <div className="w-full max-w-[880px] bg-white border border-slate-300 p-8 shadow-md rounded-lg text-[13px] leading-relaxed text-slate-900">
          {/* 1. SPORTS KITE 公司標準抬頭 */}
          <div className="text-center space-y-1 pb-3 border-b border-slate-200">
            <div className="flex justify-between items-start">
              <div className="w-20"></div>
              <div className="text-2xl font-black tracking-wider text-slate-950 font-serif">
                SPORTS KITE INTERNATIONAL CO., LTD.
              </div>
              <div className="text-[11px] font-mono text-slate-500 text-right w-20">Page: 1 of 1</div>
            </div>
            <div className="text-xs text-slate-600 font-medium">
              TEL : (886) 2763-5455 &nbsp;&nbsp; FAX: (886) 2753-4365 &nbsp;&nbsp; www.sportskite.com.tw
            </div>
            <div className="text-2xl font-black tracking-widest text-slate-950 pt-2 underline underline-offset-4 decoration-2">
              採 購 單
            </div>
          </div>

          {/* 2. 採購單主檔資訊（兩欄式對齊） */}
          <div className="grid grid-cols-12 gap-x-6 gap-y-2 py-4 text-xs leading-relaxed border-b border-slate-200">
            {/* 左側資訊 */}
            <div className="col-span-7 space-y-1.5">
              {/* 供應商 / 工廠名稱（若無資料字體反紅） */}
              <div
                className={`p-1.5 rounded transition-all ${
                  isSupplierMissing
                    ? 'bg-red-50/90 border border-red-300 ring-2 ring-red-300/60'
                    : getHighlightClass('factorySupplier')
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">供 應 商: </span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={order.factorySupplier || ''}
                      onChange={(e) => handleUpdateField('factorySupplier', e.target.value)}
                      placeholder="請輸入工廠名稱 (如: 晉江市蜀諾服裝有限公司)"
                      className="ml-2 flex-1 px-2 py-1 text-xs font-bold text-slate-950 bg-white border border-blue-400 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  ) : isSupplierMissing ? (
                    <span
                      onClick={() => setIsEditing(true)}
                      className="text-red-600 font-extrabold text-sm cursor-pointer hover:underline flex items-center gap-1 bg-red-100/60 px-2 py-0.5 rounded border border-red-300"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      ⚠️ 尚未填寫工廠名稱 (點此線上微調輸入)
                    </span>
                  ) : (
                    <span
                      className="font-bold text-slate-950 text-sm cursor-pointer"
                      onClick={() => onFieldClick?.('factorySupplier')}
                    >
                      {order.factorySupplier}
                    </span>
                  )}
                </div>
              </div>

              {/* 付款方式（支援訂金備註） */}
              <div className="p-1 rounded bg-slate-50/80 border border-slate-200 text-slate-800">
                <span className="font-bold text-slate-900">付款方式 : </span>
                {isEditing ? (
                  <textarea
                    rows={2}
                    value={order.factoryTerms || ''}
                    onChange={(e) => handleUpdateField('factoryTerms', e.target.value)}
                    placeholder="輸入工廠付款方式條款"
                    className="w-full mt-1 p-1.5 text-xs text-slate-900 bg-white border border-blue-400 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                ) : (
                  <span className="whitespace-pre-line leading-relaxed font-medium">
                    {dynamicPaymentTerms}
                  </span>
                )}
              </div>

              <div>
                <span className="font-bold text-slate-700">交貨地點 : </span>
                <span className="font-medium text-slate-900">{order.deliveryPlace || '待通知'}</span>
              </div>

              {/* 交貨日期 + 包裝標籤 */}
              <div className="flex items-center justify-between gap-2">
                <div
                  className={`p-1 rounded flex-1 ${getHighlightClass('factoryShipDate')}`}
                  onClick={() => onFieldClick?.('factoryShipDate')}
                >
                  <span className="font-bold text-slate-700">交貨日期 : </span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={order.factoryShipDate || ''}
                      onChange={(e) => handleUpdateField('factoryShipDate', e.target.value)}
                      placeholder="如: 2026年04月30日前出貨(一定嚴準時)"
                      className="px-2 py-0.5 text-xs font-bold text-slate-950 bg-white border border-blue-400 rounded outline-none"
                    />
                  ) : (
                    <span className="font-bold text-slate-950">{order.factoryShipDate}</span>
                  )}
                </div>

                {/* PDF 標誌性包裝方塊 */}
                <div
                  className={`border px-3 py-0.5 text-xs font-bold shadow-xs ${
                    isPrepackOrder
                      ? 'border-purple-800 bg-purple-50 text-purple-950'
                      : 'border-emerald-800 bg-emerald-50 text-emerald-950'
                  }`}
                >
                  {isPrepackOrder ? '混码包装' : '单码包装'}
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-700">交易條件 : </span>
                <span className="font-bold text-slate-950">
                  {order.tradeTerms.includes('FOB') ? `FOB ${order.port}` : order.tradeTerms}
                </span>
              </div>
            </div>

            {/* 右側資訊 */}
            <div className="col-span-5 space-y-2 pl-4 border-l border-slate-200">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-700">採購日期: </span>
                <span className="font-mono font-semibold text-slate-950">
                  {order.piDate}
                </span>
              </div>

              <div
                className={`p-1.5 rounded border border-blue-200 bg-blue-50/60 ${getHighlightClass(
                  'piNumber'
                )}`}
                onClick={() => onFieldClick?.('piNumber')}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-blue-900 text-xs">採購單號: </span>
                  <span className="font-mono font-extrabold text-blue-950 text-sm underline">
                    {order.piNumber}
                  </span>
                </div>
              </div>

              <div
                className={`p-1.5 rounded border border-purple-200 bg-purple-50/60 ${getHighlightClass(
                  'poNumber'
                )}`}
                onClick={() => onFieldClick?.('poNumber')}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-purple-900 text-xs">客人訂單: </span>
                  <span className="font-mono font-bold text-purple-950">{order.poNumber}</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="font-bold text-slate-700">供應商號: </span>
                <span className="font-mono font-bold text-slate-900">{order.supplierCode || 'LA'}</span>
              </div>

              <div className="flex justify-between items-center text-[11px] pt-0.5">
                <span className="text-slate-500 font-medium">計價幣別: </span>
                <span
                  className={`font-mono font-bold px-2 py-0.5 rounded ${
                    currency === 'USD'
                      ? 'bg-blue-100 text-blue-900'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {currency === 'USD' ? '美金 (USD $)' : '人民幣 (RMB ¥)'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. 主明細表（面料規格放再下一列，單價/總數對齊原版，缺單價反紅） */}
          <div className="mt-4">
            <table className="w-full border-collapse border-t-2 border-b-2 border-slate-900 text-xs">
              <thead>
                <tr className="border-b border-slate-900 font-bold text-slate-900">
                  <th className="py-2 px-1 w-10 text-center">序號</th>
                  <th className="py-2 px-2 w-32 text-left">產品編號</th>
                  <th className="py-2 px-2 text-left">規 格 / 說 明</th>
                  <th className="py-2 px-2 w-24 text-right">
                    總 數<br />
                    <span className="font-normal text-[11px] text-slate-600">({quantityUnit})</span>
                  </th>
                  <th className="py-2 px-2 w-32 text-right">
                    單 價<br />
                    <span className="font-normal text-[11px] text-slate-600">
                      ({activeCurrencyUnit})
                    </span>
                  </th>
                  <th className="py-2 px-2 w-28 text-right">
                    金 額<br />
                    <span className="font-normal text-[11px] text-slate-600">
                      {activeCurrencyLabel}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {order.items.map((item, idx) => {
                  const itemQty =
                    item.totalQuantity || item.colors.reduce((sum, c) => sum + c.totalQuantity, 0);
                  const unitPrice = currency === 'USD' ? item.unitPriceUSD : item.unitPriceRMB;
                  const itemAmt = itemQty * (unitPrice || 0);

                  const isPriceMissing = !unitPrice || unitPrice <= 0;
                  const isChineseNameMissing =
                    !item.chineseName ||
                    item.chineseName.trim() === '' ||
                    item.chineseName === '未對照品名';
                  const isSpecMissing = !item.chineseSpec || item.chineseSpec.trim() === '';

                  return (
                    <React.Fragment key={item.id}>
                      {/* 商品列：品名在一行，面料規格放再下一列！ */}
                      <tr className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-1 text-center font-bold text-slate-900 align-top">
                          {idx + 1}
                        </td>
                        <td
                          className={`py-2.5 px-2 font-mono font-bold text-slate-900 align-top ${getHighlightClass(
                            'itemNo'
                          )}`}
                          onClick={() => onFieldClick?.('itemNo')}
                        >
                          <div>{item.itemNo}</div>
                          {/* 同步存至對照庫按鈕 */}
                          {isEditing && (
                            <button
                              type="button"
                              onClick={() => handleSyncItemToDb(item)}
                              className="mt-1 px-1.5 py-0.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-[10px] flex items-center gap-1 shadow-xs"
                              title="將此款號的中文品名、面料與單價儲存至對照庫"
                            >
                              <Database className="w-2.5 h-2.5" />
                              存對照庫
                            </button>
                          )}
                        </td>

                        {/* 規 格 / 說 明: 品名 + 下一列面料規格 + 尺寸 */}
                        <td className="py-2.5 px-2 align-top space-y-1.5">
                          {/* 第一列: 品名 (若無則字體反紅) */}
                          <div>
                            {isEditing ? (
                              <input
                                type="text"
                                value={item.chineseName}
                                onChange={(e) =>
                                  handleUpdateItem(idx, { chineseName: e.target.value })
                                }
                                placeholder="請輸入中文品名 (如: ABC男士短袖T恤)"
                                className="w-full px-2 py-0.5 text-xs font-bold text-slate-950 bg-white border border-blue-400 rounded outline-none"
                              />
                            ) : isChineseNameMissing ? (
                              <span
                                onClick={() => setIsEditing(true)}
                                className="text-red-600 font-extrabold text-xs cursor-pointer hover:underline bg-red-50 border border-red-300 px-2 py-0.5 rounded inline-flex items-center gap-1"
                              >
                                <AlertCircle className="w-3 h-3 text-red-600" />
                                ⚠️ 缺中文品名 (點此線上微調輸入)
                              </span>
                            ) : (
                              <div className="font-bold text-slate-950 text-[13px]">
                                {item.chineseName}
                              </div>
                            )}
                          </div>

                          {/* 第二列: 面料規格 / 成分克重（放再下一列，若無則字體反紅） */}
                          <div>
                            {isEditing ? (
                              <textarea
                                rows={2}
                                value={item.chineseSpec}
                                onChange={(e) =>
                                  handleUpdateItem(idx, { chineseSpec: e.target.value })
                                }
                                placeholder="請輸入中文面料規格 (如: 面料:全滌 75D/72F小針眼布+吸濕排汗助劑 (布重:135GM/M2))"
                                className="w-full p-1.5 text-xs text-slate-900 bg-white border border-blue-400 rounded outline-none"
                              />
                            ) : isSpecMissing ? (
                              <div
                                onClick={() => setIsEditing(true)}
                                className="text-red-600 font-bold text-xs cursor-pointer hover:underline bg-red-50 border border-red-300 p-1.5 rounded inline-flex items-center gap-1"
                              >
                                <AlertCircle className="w-3 h-3 text-red-600" />
                                ⚠️ 缺面料規格說明 (點此線上微調輸入)
                              </div>
                            ) : (
                              <div className="text-slate-800 font-medium text-xs leading-relaxed bg-amber-50/40 p-1.5 rounded border border-amber-200/60">
                                {item.chineseSpec}
                              </div>
                            )}
                          </div>

                          {/* 第三列: 尺寸範圍 */}
                          <div className="text-slate-600 font-mono text-[11px]">
                            尺寸: {item.sizes.join('/ ')}
                          </div>
                        </td>

                        {/* 總數 (件) */}
                        <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-950 align-top text-[13px]">
                          {itemQty.toLocaleString()}
                        </td>

                        {/* 單 價（若無資料字體反紅） */}
                        <td className="py-2.5 px-2 text-right font-mono font-semibold align-top">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[11px] text-slate-500 font-sans">
                                {currency === 'USD' ? '$' : '¥'}
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={unitPrice || ''}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  if (currency === 'USD') {
                                    handleUpdateItem(idx, { unitPriceUSD: val });
                                  } else {
                                    handleUpdateItem(idx, { unitPriceRMB: val });
                                  }
                                }}
                                placeholder="0.00"
                                className="w-20 px-1 py-0.5 text-right font-bold text-slate-950 bg-white border border-blue-400 rounded outline-none text-xs"
                              />
                            </div>
                          ) : isPriceMissing ? (
                            <span
                              onClick={() => setIsEditing(true)}
                              className="text-red-600 font-black text-xs cursor-pointer hover:underline bg-red-50 border border-red-400 px-2 py-1 rounded inline-flex items-center gap-1 shadow-xs animate-pulse"
                              title="未抓取到工廠單價，點此線上微調輸入"
                            >
                              <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                              ⚠️ 缺工廠單價
                            </span>
                          ) : (
                            <span className="text-slate-900 font-bold">
                              {unitPrice.toFixed(2)}
                            </span>
                          )}
                        </td>

                        {/* 金 額 */}
                        <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-950 align-top text-[13px]">
                          {isPriceMissing ? (
                            <span className="text-red-600 font-extrabold text-xs">-- (缺單價)</span>
                          ) : (
                            itemAmt.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          )}
                        </td>
                      </tr>

                      {/* 混碼包裝明細（若為混碼且選擇「含混碼裝袋明細」版本，展開同一配比數量合併排列） */}
                      {isPrepackOrder && multiplePackViewMode === 'detail' && (
                        <tr>
                          <td></td>
                          <td colSpan={5} className="py-2 pr-2">
                            <div className="bg-purple-50/40 p-3 rounded border border-purple-200 space-y-2">
                              <div className="text-[11px] font-bold text-purple-950 flex items-center justify-between">
                                <span>
                                  [{item.itemNo}] 工廠裁剪與混碼裝袋明細（同配比放一起，依序排列）
                                </span>
                                <span className="text-[10px] text-purple-800 bg-purple-100 px-2 py-0.5 rounded font-medium">
                                  每包裝袋規格
                                </span>
                              </div>

                              <table className="w-full border-collapse border border-slate-300 text-[11px] bg-white text-center">
                                <thead>
                                  <tr className="bg-slate-100 font-bold border-b border-slate-300">
                                    <th
                                      rowSpan={2}
                                      className="border border-slate-300 p-1.5 text-left pl-3 w-56 font-bold align-middle"
                                    >
                                      顏色名稱 / 色號
                                    </th>
                                    <th
                                      colSpan={item.sizes.length}
                                      className="border border-slate-300 p-1 font-bold"
                                    >
                                      尺碼 (SIZE)
                                    </th>
                                    <th
                                      rowSpan={2}
                                      className="border border-slate-300 p-1.5 font-bold bg-slate-200/80 w-24 align-middle"
                                    >
                                      合 計
                                    </th>
                                  </tr>
                                  <tr className="bg-slate-100 font-bold border-b border-slate-300">
                                    {item.sizes.map((s) => (
                                      <th
                                        key={s}
                                        className="border border-slate-300 p-1 font-mono min-w-[38px]"
                                      >
                                        {s}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    const ratioGroups = groupColorsByRatio(item.colors, item.sizes);

                                    return ratioGroups.map((group, gIdx) => (
                                      <React.Fragment key={group.ratioKey || gIdx}>
                                        {/* 配比列：標明此組每袋配比，數值精準對齊上方尺碼 */}
                                        <tr className="bg-purple-100/70 border-b border-slate-300 text-purple-950 font-bold">
                                          <td className="border border-slate-300 p-1.5 text-left pl-3 text-purple-950 font-bold flex items-center justify-between">
                                            <span>每袋混碼配比 ({group.piecesPerPack} 件/包)</span>
                                            <span className="text-[10px] text-purple-800 bg-purple-200/70 px-1.5 py-0.2 rounded font-normal">
                                              {group.colors.length} 款顏色
                                            </span>
                                          </td>
                                          {item.sizes.map((s) => {
                                            const pRatio =
                                              group.ratioBySize[s] !== undefined
                                                ? group.ratioBySize[s]
                                                : '-';
                                            return (
                                              <td
                                                key={s}
                                                className="border border-slate-300 p-1.5 font-mono text-purple-950 font-extrabold text-[12px]"
                                              >
                                                {pRatio}
                                              </td>
                                            );
                                          })}
                                          <td className="border border-slate-300 p-1.5 font-mono font-bold text-purple-950 bg-purple-200/70 text-[11px]">
                                            {group.piecesPerPack} 件/包
                                          </td>
                                        </tr>

                                        {/* 屬於此配比數量的所有顏色依系列出 */}
                                        {group.colors.map((c) => (
                                          <tr
                                            key={c.id}
                                            className="hover:bg-slate-50 border-b border-slate-300"
                                          >
                                            <td className="border border-slate-300 p-1.5 text-left pl-3 text-slate-900 font-semibold">
                                              {c.colorName} ({c.colorCode}) 實際裁剪件數
                                            </td>
                                            {item.sizes.map((s) => (
                                              <td
                                                key={s}
                                                className="border border-slate-300 p-1.5 font-mono font-bold text-slate-900"
                                              >
                                                {(c.quantitiesBySize[s] ?? 0).toLocaleString()}
                                              </td>
                                            ))}
                                            <td className="border border-slate-300 p-1.5 font-mono font-bold text-slate-900 bg-slate-100/80">
                                              {c.totalQuantity.toLocaleString()} 件
                                            </td>
                                          </tr>
                                        ))}
                                      </React.Fragment>
                                    ));
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Normal Pack (一般單碼裝) 尺碼裁剪展開表 */}
                      {!isPrepackOrder && item.colors.length > 0 && (
                        <tr>
                          <td></td>
                          <td colSpan={5} className="py-2 pr-2">
                            <div className="bg-emerald-50/40 p-3 rounded border border-emerald-200 space-y-2">
                              <div className="text-[11px] font-bold text-emerald-950 flex items-center justify-between">
                                <span>
                                  [{item.itemNo}] 各顏色尺碼裁剪分配明細表 (Normal Pack 單碼裝)
                                </span>
                                <span className="text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-medium">
                                  單碼個別包裝
                                </span>
                              </div>

                              <table className="w-full border-collapse border border-slate-300 text-[11px] bg-white text-center">
                                <thead>
                                  <tr className="bg-slate-100 font-bold border-b border-slate-300">
                                    <th className="border border-slate-300 p-1.5 text-left pl-3 w-56 font-bold">
                                      顏色名稱 / 色號
                                    </th>
                                    {item.sizes.map((s) => (
                                      <th
                                        key={s}
                                        className="border border-slate-300 p-1 font-mono min-w-[38px]"
                                      >
                                        {s}
                                      </th>
                                    ))}
                                    <th className="border border-slate-300 p-1.5 font-bold bg-slate-200/80 w-24">
                                      合 計 ({quantityUnit})
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.colors.map((c) => (
                                    <tr
                                      key={c.id}
                                      className="hover:bg-slate-50 border-b border-slate-300"
                                    >
                                      <td className="border border-slate-300 p-1.5 text-left pl-3 text-slate-900 font-semibold">
                                        {c.colorName} ({c.colorCode})
                                      </td>
                                      {item.sizes.map((s) => (
                                        <td
                                          key={s}
                                          className="border border-slate-300 p-1.5 font-mono font-bold text-slate-900"
                                        >
                                          {(c.quantitiesBySize[s] ?? 0).toLocaleString()}
                                        </td>
                                      ))}
                                      <td className="border border-slate-300 p-1.5 font-mono font-bold text-slate-900 bg-slate-100/80">
                                        {c.totalQuantity.toLocaleString()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>

              {/* 合 計 列 */}
              <tfoot>
                <tr className="border-t-2 border-b-2 border-slate-900 font-bold text-slate-950">
                  <td colSpan={3} className="py-2.5 px-2 font-bold tracking-wider">
                    合 計 :
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-sm">
                    {totalPieces.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2 text-right font-bold text-slate-700">{currency}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-sm">
                    {missingPriceCount > 0 ? (
                      <span className="text-red-600 text-xs">有缺單價</span>
                    ) : (
                      activeTotalAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 4. 金額總計大寫 */}
          <div className="py-2.5 text-xs text-slate-900 border-b border-slate-200">
            <span className="font-bold">金額總計: </span>
            <span className="font-serif font-bold text-sm tracking-wide text-slate-950">
              {missingPriceCount > 0 ? (
                <span className="text-red-600">（請先微調補齊工廠單價以顯示總計金額）</span>
              ) : (
                chineseAmountWords
              )}
            </span>
          </div>

          {/* 5. 【關鍵條款】REACH 環保標準（原版大字粗體置中 - 全繁體字） */}
          <div className="py-3 text-center">
            <div className="text-sm font-black text-slate-950 tracking-wider inline-flex items-center gap-1.5">
              <span>****所有主副料均需環保,符合歐洲REACH環保標準****</span>
            </div>
          </div>

          {/* 6. 注意事項條款（1~6點，全繁體中文字） */}
          <div className="border border-slate-300 p-3.5 bg-slate-50/70 text-[11px] leading-relaxed text-slate-900 space-y-1">
            <div className="font-bold text-slate-950 mb-1">注意事項:</div>
            <ol className="list-decimal list-inside space-y-0.5 text-slate-800">
              <li>
                所有交貨品質, 需依據本公司確認之樣品, 產前樣及客確認意見為準,
                若有任何品質問題, 工廠須負一切損失賠償責任。
              </li>
              <li>
                布料, 副料, 印花, 繡花等加工, 需依指定標準,
                洗水色牢度需達4級以上, 不得有移色或縮水嚴重等問題。
              </li>
              <li>
                大貨包裝方式, 混碼裝袋比例, 外箱麥頭及條碼標籤,
                必須完全依照本公司包裝指示文件操作, 嚴禁裝錯。
              </li>
              <li>
                本訂單之交貨日期為最後出運期, 工廠務必嚴格準時交貨,
                若有延誤造成空運或客戶索賠, 概由工廠全額承擔。
              </li>
              <li>
                出貨前必須經本公司品管人員驗貨合格, 並取得出貨許可後,
                方可安排裝櫃出運。
              </li>
              <li>
                款項結算依本採購單約定之付款方式, 備齊各項請款單據後辦理支付。
              </li>
            </ol>
          </div>

          {/* 7. 簽名核準區 */}
          <div className="grid grid-cols-2 gap-8 pt-8 mt-4 text-xs">
            <div className="space-y-8">
              <div className="font-bold text-slate-900">
                買 方 : SPORTS KITE INTERNATIONAL CO., LTD.
              </div>
              <div className="border-b border-slate-400 w-48"></div>
              <div className="text-[11px] text-slate-500 font-medium">經辦 / 核準人簽章</div>
            </div>

            <div className="space-y-8 text-right flex flex-col items-end">
              <div className="font-bold text-slate-900">
                賣 方 (工廠確認簽章) :{' '}
                {isSupplierMissing ? (
                  <span className="text-red-600 font-extrabold">【待填寫工廠名稱】</span>
                ) : (
                  order.factorySupplier
                )}
              </div>
              <div className="border-b border-slate-400 w-48"></div>
              <div className="text-[11px] text-slate-500 font-medium">工廠負責人簽署並加蓋公章</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
