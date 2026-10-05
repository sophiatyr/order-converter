import React, { useState } from 'react';
import { OrderData } from '../types/order';
import { ArrowRight, Check, Eye, HelpCircle, Layers, Sparkles } from 'lucide-react';

interface Props {
  order: OrderData;
  activeSampleType: 'normal' | 'multiple' | 'single' | 'multi' | 'prepack' | 'custom';
}

interface MappingCard {
  id: string;
  category: string;
  sourceLabel: string;
  sourceValue: string;
  targetPILabel: string;
  targetPIValue: string;
  targetFactoryLabel?: string;
  targetFactoryValue?: string;
  ruleExplanation: string;
  colorTheme: string;
}

export const MappingInspector: React.FC<Props> = ({ order, activeSampleType }) => {
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);

  const mappingCards: MappingCard[] = [
    {
      id: 'order-no',
      category: '訂單編號',
      sourceLabel: 'PDF Order number',
      sourceValue: order.poNumber,
      targetPILabel: "CISALFA'S ORDER NO (P/O) & P/I NO (S/C)",
      targetPIValue: `${order.poNumber} ➔ ${order.piNumber}`,
      targetFactoryLabel: '採購單號 (S/C) & 客人訂單',
      targetFactoryValue: `${order.piNumber} (客人: ${order.poNumber})`,
      ruleExplanation:
        '客人訂單號原樣保留為 P/O。內部 S/C (P/I) 編號取客戶代碼 CS + 去除 OF 後的訂單數字 (26OF002273 ➔ CS26002273)。',
      colorTheme: 'border-red-300 bg-red-50/50 text-red-900',
    },
    {
      id: 'ship-date',
      category: '出貨日期',
      sourceLabel: 'PDF Ship date on board',
      sourceValue: '15/05/2026',
      targetPILabel: 'SHIPMENT (客人出貨日)',
      targetPIValue: order.shipmentDate,
      targetFactoryLabel: '交貨日期 (工廠備貨出運)',
      targetFactoryValue: order.factoryShipDate,
      ruleExplanation:
        '客人出貨日轉為英文月日格式 (BEFORE MAY. 15, 2026)；工廠採購單交期自動往前推算 15 天 (4月30日)，預留集貨報關時間。',
      colorTheme: 'border-orange-300 bg-orange-50/50 text-orange-900',
    },
    {
      id: 'terms-port',
      category: '貿易條款與港口',
      sourceLabel: 'PDF Delivery terms + Port + Mode',
      sourceValue: `${order.tradeTerms.split(' ')[0]} / ${order.port} / ${order.modeOfDelivery}`,
      targetPILabel: 'TERMS (貿易與運輸條款)',
      targetPIValue: order.tradeTerms,
      targetFactoryLabel: '交易條件',
      targetFactoryValue: `FOB ${order.port}`,
      ruleExplanation:
        '將 FOB 條款、裝運港 XIAMEN 與運輸方式 BY SEA 自動組裝為國際標準貿易條款 "FOB XIAMEN BY SEA"。',
      colorTheme: 'border-sky-300 bg-sky-50/50 text-sky-900',
    },
    {
      id: 'item-code',
      category: '產品編號與大類',
      sourceLabel: 'PDF Vendor part number',
      sourceValue: `${order.items[0]?.itemNo}-050 (含顏色後綴)`,
      targetPILabel: 'ITEM NO. (產品大類)',
      targetPIValue: order.items[0]?.itemNo || '',
      targetFactoryLabel: '產品編號 (產品大類)',
      targetFactoryValue: order.items[0]?.itemNo || '',
      ruleExplanation:
        '將客人完整款號 (如 AFB831W26-050 或 RCL010-001/050) 按照橫線拆解，前半部作為產品大類 ITEM NO.，後半部提取為顏色組合。',
      colorTheme: 'border-emerald-300 bg-emerald-50/50 text-emerald-900',
    },
    {
      id: 'item-desc',
      category: '產品名稱與規格',
      sourceLabel: 'PDF Description',
      sourceValue: order.items[0]?.styleName + ' - ' + order.items[0]?.description,
      targetPILabel: 'DESCRIPTION (品名與規格)',
      targetPIValue: `${order.items[0]?.styleName} / ${order.items[0]?.description}`,
      targetFactoryLabel: '產品名稱(翻中文) / 規格 / 說明',
      targetFactoryValue: `${order.items[0]?.chineseName} / ${order.items[0]?.chineseSpec}`,
      ruleExplanation:
        'P/I 保留英文品名與全英文成分規格；工廠採購單自動翻譯為中文品名與成衣面料規格 (如全滌75D/72F雙面布+吸排)。',
      colorTheme: 'border-indigo-300 bg-indigo-50/50 text-indigo-900',
    },
    {
      id: 'size-matrix',
      category: '尺碼與數量配比',
      sourceLabel: 'PDF 尺碼橫排數量 (Multiplo)',
      sourceValue: order.items[0]?.sizes.map(s => `${s}:${order.items[0]?.colors[0]?.quantitiesBySize[s] || 0}`).join(' | '),
      targetPILabel: 'COLOR COMBINATION & COLOR / SIZE 矩陣',
      targetPIValue: `總件數: ${order.items[0]?.totalQuantity} 件 (自動展開二維配比)`,
      targetFactoryLabel: '工廠各顏色 / 尺碼配比裁剪表',
      targetFactoryValue: `裁剪件數: ${order.items[0]?.totalQuantity} 件`,
      ruleExplanation:
        '自動將 PDF 中的 Multiplo 尺碼欄位與單色數量，轉換成 Excel 橫向配色表與二維交叉尺碼矩陣，並檢核合計。',
      colorTheme: 'border-purple-300 bg-purple-50/50 text-purple-900',
    },
    {
      id: 'price-total',
      category: '單價、金額與大寫轉換',
      sourceLabel: 'PDF Unit price & Total amount',
      sourceValue: `USD ${(order.items[0]?.unitPriceUSD || 0).toFixed(2)} | Total USD ${(order.totalAmountUSD || 0).toFixed(2)}`,
      targetPILabel: 'SAY TOTAL US DOLLARS...',
      targetPIValue: `USD ${(order.totalAmountUSD || 0).toFixed(2)} (附英文金融大寫)`,
      targetFactoryLabel: '供應商單價 & 金額總計',
      targetFactoryValue: `RMB ${(order.items[0]?.unitPriceRMB || 0).toFixed(2)} / 金額總計: 人民幣大寫`,
      ruleExplanation:
        'P/I 自動以英文大寫 SAY TOTAL US DOLLARS... 結尾；工廠單以 RMB 單價計算加工總額，並自動生成傳統中文大寫「人民幣陸仟肆佰捌拾元整」。',
      colorTheme: 'border-rose-300 bg-rose-50/50 text-rose-900',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overview callout banner */}
      <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300">
                <Sparkles className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-base tracking-wide">
                對照表映射深度剖析 (PDF ➔ Excel P/I ＆ 工廠採購單)
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              系統根據您提供的 3 頁對照表，精確建立了一對一及聚合映射規則。點擊下方任一對照項目，可即時查看其轉換邏輯與計算公式。
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white border border-white/10 font-mono">
              當前案例：
              {activeSampleType === 'normal'
                ? 'Normal Pack (一般單碼裝 26OF002273)'
                : activeSampleType === 'multiple'
                ? 'Multiple Pack (單色混碼裝袋)'
                : '自訂上傳訂單'}
            </span>
          </div>
        </div>
      </div>

      {/* Visual Flow diagram */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Source Box */}
        <div className="bg-white border-2 border-slate-300 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              客人原始 PDF 訂單
            </span>
            <span className="text-[11px] text-slate-500 font-mono">Cisalfa Sport</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="p-2 rounded bg-slate-50 border border-slate-200">
              <span className="text-slate-500 font-semibold">Order number: </span>
              <span className="font-mono font-bold text-slate-900">{order.poNumber}</span>
            </div>
            <div className="p-2 rounded bg-slate-50 border border-slate-200">
              <span className="text-slate-500 font-semibold">Vendor part number: </span>
              <span className="font-mono font-bold text-blue-900">{order.items[0]?.itemNo}-050</span>
            </div>
            <div className="p-2 rounded bg-slate-50 border border-slate-200">
              <span className="text-slate-500 font-semibold">Ship date on board: </span>
              <span className="font-mono text-slate-800">15/05/2026</span>
            </div>
            <div className="p-2 rounded bg-slate-50 border border-slate-200">
              <span className="text-slate-500 font-semibold">Quantity / Price: </span>
              <span className="font-mono font-bold text-emerald-700">
                {order.items[0]?.totalQuantity} PZ @ ${order.items[0]?.unitPriceUSD.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Target 1 Box (English PI) */}
        <div className="bg-white border-2 border-blue-400 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="font-bold text-sm text-blue-900 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              生成的英文 P/I (S/C)
            </span>
            <span className="text-[11px] text-blue-700 font-mono font-semibold">Sheet 1</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="p-2 rounded bg-blue-50/60 border border-blue-200">
              <span className="text-blue-700 font-semibold">P/I NO.: </span>
              <span className="font-mono font-bold text-blue-950">{order.piNumber}</span>
            </div>
            <div className="p-2 rounded bg-blue-50/60 border border-blue-200">
              <span className="text-blue-700 font-semibold">ITEM NO. (大類): </span>
              <span className="font-mono font-bold text-blue-950">{order.items[0]?.itemNo}</span>
            </div>
            <div className="p-2 rounded bg-blue-50/60 border border-blue-200">
              <span className="text-blue-700 font-semibold">SHIPMENT: </span>
              <span className="font-mono text-blue-950">{order.shipmentDate}</span>
            </div>
            <div className="p-2 rounded bg-blue-50/60 border border-blue-200">
              <span className="text-blue-700 font-semibold">配比矩陣: </span>
              <span className="font-mono text-blue-950">COLOR COMBINATION & SIZES</span>
            </div>
          </div>
        </div>

        {/* Target 2 Box (Chinese Factory PO) */}
        <div className="bg-white border-2 border-amber-400 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="font-bold text-sm text-amber-900 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
              工廠中文採購單
            </span>
            <span className="text-[11px] text-amber-700 font-mono font-semibold">Sheet 2</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="p-2 rounded bg-amber-50/60 border border-amber-200">
              <span className="text-amber-800 font-semibold">採購單號： </span>
              <span className="font-mono font-bold text-amber-950">{order.piNumber}</span>
            </div>
            <div className="p-2 rounded bg-amber-50/60 border border-amber-200">
              <span className="text-amber-800 font-semibold">中文品名： </span>
              <span className="font-bold text-amber-950">{order.items[0]?.chineseName}</span>
            </div>
            <div className="p-2 rounded bg-amber-50/60 border border-amber-200">
              <span className="text-amber-800 font-semibold">工廠交期： </span>
              <span className="font-mono font-bold text-rose-700">{order.factoryShipDate}</span>
            </div>
            <div className="p-2 rounded bg-amber-50/60 border border-amber-200">
              <span className="text-amber-800 font-semibold">單價 / 總計： </span>
              <span className="font-mono font-bold text-amber-950">
                ¥{order.items[0]?.unitPriceRMB.toFixed(2)} | 人民幣大寫
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Detail Mapping Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            各欄位轉換邏輯卡片 (點擊可高亮聚焦)
          </h4>
          <span className="text-xs text-slate-500">共 7 組關鍵邏輯</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {mappingCards.map((card) => {
            const isSelected = activeHighlight === card.id;

            return (
              <div
                key={card.id}
                onClick={() => setActiveHighlight(isSelected ? null : card.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-blue-600 border-blue-400 bg-blue-50/40 shadow-md'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    {card.category}
                  </span>
                  <span className="text-[10px] text-slate-500 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                    點擊聚焦
                  </span>
                </div>

                {/* Source to Target Row */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-start justify-between bg-slate-50 p-2 rounded border border-slate-200">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-400 uppercase font-mono">
                        {card.sourceLabel}
                      </span>
                      <div className="font-mono font-bold text-slate-800 truncate max-w-[280px]">
                        {card.sourceValue}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 mt-2" />
                    <div className="space-y-0.5 text-right">
                      <span className="text-[10px] text-blue-600 uppercase font-mono font-semibold">
                        {card.targetPILabel}
                      </span>
                      <div className="font-mono font-bold text-blue-900 truncate max-w-[280px]">
                        {card.targetPIValue}
                      </div>
                    </div>
                  </div>

                  {card.targetFactoryValue && (
                    <div className="text-[11px] bg-amber-50/70 p-2 rounded border border-amber-200 text-amber-900 flex items-center justify-between">
                      <span className="font-semibold">{card.targetFactoryLabel}:</span>
                      <span className="font-mono font-bold">{card.targetFactoryValue}</span>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-600 leading-relaxed bg-white p-2 rounded border border-slate-100">
                    <span className="font-semibold text-slate-700">邏輯說明：</span>
                    {card.ruleExplanation}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
