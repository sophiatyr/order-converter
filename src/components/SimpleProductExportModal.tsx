import React from 'react';
import { OrderData } from '../types/order';
import { exportSimpleProductExcel } from '../utils/excelExport';
import { Download, FileSpreadsheet, X, Check, Table } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: OrderData;
}

export const SimpleProductExportModal: React.FC<Props> = ({ isOpen, onClose, order }) => {
  if (!isOpen) return null;

  const totalQty = order.items.reduce(
    (sum, item) =>
      sum + (item.totalQuantity || item.colors.reduce((csum, c) => csum + (c.totalQuantity || 0), 0)),
    0
  );

  const totalAmount = order.items.reduce((sum, item) => {
    const qty =
      item.totalQuantity || item.colors.reduce((csum, c) => csum + (c.totalQuantity || 0), 0);
    return sum + qty * (item.unitPriceUSD || 0);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in font-sans">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-wide">
                產品數量金額清單 Excel（5欄標準格式）
              </h2>
              <p className="text-xs text-emerald-100">
                嚴格依照指定範本格式生成：產品編號 / 客戶產品編號 / 數量 / 金額 / 組合數量
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="space-y-0.5">
              <span className="text-slate-500 font-medium">訂單號碼 (P/O): </span>
              <span className="font-bold text-slate-900 font-mono">{order.poNumber}</span>
              <span className="mx-2 text-slate-300">|</span>
              <span className="text-slate-500 font-medium">總品項數: </span>
              <span className="font-bold text-slate-900">{order.items.length} 款</span>
            </div>
            <div className="space-y-0.5 text-right">
              <span className="text-slate-500 font-medium">總數量: </span>
              <span className="font-bold text-emerald-700 font-mono text-sm">
                {totalQty.toLocaleString()} 件
              </span>
              <span className="mx-2 text-slate-300">|</span>
              <span className="text-slate-500 font-medium">客戶總金額: </span>
              <span className="font-bold text-slate-900 font-mono text-sm">
                USD ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Excel Preview Grid (100% 同步使用者截圖樣式) */}
          <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-inner">
            <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300 text-[11px] font-mono text-slate-600 flex items-center justify-between">
              <span>Sheet1 (Excel 預覽) - 欄位均不能更動</span>
              <span className="text-emerald-700 font-bold">5 個指定欄位</span>
            </div>
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-300 text-slate-900 font-medium">
                    <th className="border-r border-slate-200 px-3 py-2 text-left w-10 font-mono text-slate-400">#</th>
                    <th className="border-r border-slate-200 px-3 py-2 text-left font-bold text-slate-800">
                      產品編號
                    </th>
                    <th className="border-r border-slate-200 px-3 py-2 text-left font-bold text-slate-800">
                      客戶產品編號
                    </th>
                    <th className="border-r border-slate-200 px-3 py-2 text-right font-bold text-slate-800">
                      數量
                    </th>
                    <th className="border-r border-slate-200 px-3 py-2 text-right font-bold text-slate-800">
                      金額
                    </th>
                    <th className="px-3 py-2 text-right font-bold text-slate-800">
                      組合數量
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {order.items.map((item, idx) => {
                    const itemQty =
                      item.totalQuantity ||
                      item.colors.reduce((sum, c) => sum + (c.totalQuantity || 0), 0);
                    const unitPrice = item.unitPriceUSD || 0;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="border-r border-slate-200 px-3 py-1.5 text-slate-400 text-center text-[11px]">
                          {idx + 2}
                        </td>
                        <td className="border-r border-slate-200 px-3 py-1.5 font-bold text-slate-900">
                          {item.itemNo}
                        </td>
                        <td className="border-r border-slate-200 px-3 py-1.5 text-slate-400">
                          {/* 留空如範例截圖 */}
                        </td>
                        <td className="border-r border-slate-200 px-3 py-1.5 text-right font-semibold text-slate-900">
                          {itemQty.toLocaleString()}
                        </td>
                        <td className="border-r border-slate-200 px-3 py-1.5 text-right font-semibold text-slate-900">
                          {Number.isInteger(unitPrice) ? unitPrice : unitPrice.toFixed(2)}
                        </td>
                        <td className="px-3 py-1.5 text-right text-slate-400">
                          {item.kitQty ? item.kitQty : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium rounded-xl text-xs transition-all"
          >
            關閉預覽
          </button>
          <button
            onClick={() => {
              exportSimpleProductExcel(order);
              onClose();
            }}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>立即導出產品清單 Excel (5欄格式)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
