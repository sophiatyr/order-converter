import React from 'react';
import { X, CheckCircle2, ArrowRight, FileSpreadsheet, FileText, Layers, RefreshCw } from 'lucide-react';
import { MAPPING_RULES_EXPLANATION } from '../data/sampleOrders';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const MappingGuideModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8 overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-600 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
              <CheckCircle2 className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">對照表解析確認報告 (完全看懂！)</h2>
              <p className="text-xs text-blue-100 mt-0.5">
                深度解讀 Cisalfa Sport 客人 PDF 訂單 ➔ 英文 P/I ＆ 中文工廠採購單之轉換規則
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Summary Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-950">
              <p className="font-semibold text-emerald-900 mb-1">
                回答您的問題：「我做了對照表，看得懂嗎？」
              </p>
              <p className="text-emerald-800 leading-relaxed">
                <span className="font-bold text-emerald-950">完全看得懂！</span>
                您的對照標註非常清晰專業，精準勾勒出外貿成衣訂單從客人採購單（Cisalfa PO）、我司外銷商業發票（P/I / S/C）到工廠中文採購單的三方轉換邏輯。本系統已完整實作此整套自動化機制！
              </p>
            </div>
          </div>

          {/* 3 Core Mapping Dimensions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 hover:border-blue-300 transition-all">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-sm mb-2">
                <FileText className="w-4 h-4" />
                第 1 頁：單款單色訂單
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5 leading-relaxed">
                <li>• 訂單號 <code className="bg-white px-1 py-0.5 rounded border text-blue-700">26OF002273</code> ➔ P/I NO. <code className="bg-white px-1 py-0.5 rounded border text-blue-700">CS26002273</code></li>
                <li>• 品號前綴 <code className="bg-white px-1 py-0.5 rounded border">AFB831W26</code> 作為產品大類</li>
                <li>• 後綴 <code className="bg-white px-1 py-0.5 rounded border">050</code> 分離為顏色 (BLACK)</li>
                <li>• 尺碼 <code className="bg-white px-1 py-0.5 rounded border">6A~14A</code> 橫向配比展開，總計 480 件</li>
                <li>• 單價 USD 2.30 ➔ 總計 USD 1,104.00</li>
              </ul>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 hover:border-indigo-300 transition-all">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm mb-2">
                <Layers className="w-4 h-4" />
                第 2 頁：單款多色彙整
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5 leading-relaxed">
                <li>• 同品號 <code className="bg-white px-1 py-0.5 rounded border text-indigo-700">RCL010</code> 三個顏色合併</li>
                <li>• 自動彙整為 1 個主品項 (總 1,500 件, $2,925)</li>
                <li>• 展開 3 色橫向匯總表 (白/黑、綠、海軍藍)</li>
                <li>• 交叉尺碼矩陣 (XS~XL) 精確配比</li>
                <li>• 多款號 (RCL010 + RCL005) 依序遞增 SEP 1, 2</li>
              </ul>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 hover:border-amber-300 transition-all">
              <div className="flex items-center gap-2 text-amber-700 font-bold text-sm mb-2">
                <FileSpreadsheet className="w-4 h-4" />
                第 3 頁：中文工廠採購單
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5 leading-relaxed">
                <li>• 英文品名翻中文：<code className="bg-white px-1 py-0.5 rounded border">ARENA男童T恤</code></li>
                <li>• 規格中文化 (面料、克重、工藝吸排助劑)</li>
                <li>• 交貨日嚴格提前 (客人 5/15 ➔ 工廠 4/30)</li>
                <li>• 供應商單價 (RMB 13.50 ➔ 總額 6,480.00)</li>
                <li>• 自動轉換中文大寫：<span className="text-amber-800 font-semibold">人民幣陸仟肆佰捌拾元整</span></li>
              </ul>
            </div>
          </div>

          {/* Rules Detailed List */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-600" />
              對照邏輯詳細規則明細
            </h3>
            <div className="space-y-2.5">
              {MAPPING_RULES_EXPLANATION.map((rule, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-blue-50/40 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-900 text-sm">{rule.title}</span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                      {rule.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{rule.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* S/C Formula Comparison Box */}
          <div className="bg-slate-900 text-white rounded-xl p-4 text-xs font-mono space-y-2">
            <div className="text-slate-400 font-sans font-bold text-[11px] uppercase tracking-wider">
              對照表公式對應速查
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">P/O No:</span>
              <span className="text-amber-400">26OF002273</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-400">P/I No:</span>
              <span className="text-emerald-400 font-bold">CS26002273</span>
              <span className="text-slate-500 text-[11px] font-sans">(Rule: 客人代碼 CS + 去除 OF 的序號)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Part No:</span>
              <span className="text-amber-400">AFB831W26-050</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-400">Item:</span>
              <span className="text-emerald-400">AFB831W26</span>
              <span className="text-slate-400">Color:</span>
              <span className="text-sky-300">050 BLACK</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Ship Date:</span>
              <span className="text-amber-400">15/05/2026</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-emerald-400">BEFORE MAY. 15, 2026</span>
              <span className="text-slate-500">| 工廠交期:</span>
              <span className="text-rose-300">2026年04月30日 (提前15日)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            ✓ 系統支援直接載入範例對照、上傳新 PDF 解析、線上微調與導出原生 Excel (.xlsx)
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow transition-colors"
          >
            關閉並開始使用
          </button>
        </div>
      </div>
    </div>
  );
};
