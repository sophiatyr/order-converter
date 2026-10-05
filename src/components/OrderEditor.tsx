import React from 'react';
import { OrderData, OrderItem, Colorway } from '../types/order';
import { Plus, Trash2, Edit3, DollarSign, Calendar, Building, Sparkles } from 'lucide-react';

interface Props {
  order: OrderData;
  onChange: (updated: OrderData) => void;
}

export const OrderEditor: React.FC<Props> = ({ order, onChange }) => {
  const updateField = (field: keyof OrderData, value: any) => {
    onChange({
      ...order,
      [field]: value,
    });
  };

  const updateItem = (index: number, updatedItem: OrderItem) => {
    const newItems = [...order.items];
    newItems[index] = updatedItem;
    onChange({
      ...order,
      items: newItems,
    });
  };

  const handleQuantityChange = (itemIdx: number, colorIdx: number, size: string, value: number) => {
    const newItems = [...order.items];
    const targetItem = { ...newItems[itemIdx] };
    const targetColor = { ...targetItem.colors[colorIdx] };

    const newQuantities = {
      ...targetColor.quantitiesBySize,
      [size]: Math.max(0, value || 0),
    };

    const newTotal = Object.values(newQuantities).reduce((a, b) => a + b, 0);

    targetColor.quantitiesBySize = newQuantities;
    targetColor.totalQuantity = newTotal;

    targetItem.colors = [...targetItem.colors];
    targetItem.colors[colorIdx] = targetColor;

    const itemTotal = targetItem.colors.reduce((sum, c) => sum + c.totalQuantity, 0);
    targetItem.totalQuantity = itemTotal;
    targetItem.totalAmountUSD = itemTotal * targetItem.unitPriceUSD;
    targetItem.totalAmountRMB = itemTotal * targetItem.unitPriceRMB;

    newItems[itemIdx] = targetItem;
    onChange({ ...order, items: newItems });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-blue-600" />
            線上訂單資料微調與設定 (即時同步 Excel)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            在此修改的任何欄位，都會即時計算並同步至英文 P/I、中文工廠採購單與導出的 Excel 檔案。
          </p>
        </div>
      </div>

      {/* Basic Order Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div>
          <label className="block text-slate-600 font-semibold mb-1">
            客人訂單號碼 (P/O NO.):
          </label>
          <input
            type="text"
            value={order.poNumber}
            onChange={(e) => updateField('poNumber', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg font-mono focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-slate-600 font-semibold mb-1">
            我司訂單號 / S/C (P/I NO.):
          </label>
          <input
            type="text"
            value={order.piNumber}
            onChange={(e) => updateField('piNumber', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg font-mono font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-slate-600 font-semibold mb-1">
            客戶名稱 / 代號 (CUST#):
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={order.customerName}
              onChange={(e) => updateField('customerName', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <input
              type="text"
              value={order.customerCode}
              onChange={(e) => updateField('customerCode', e.target.value)}
              className="w-20 px-2 py-2 border rounded-lg font-mono text-center focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-600 font-semibold mb-1">
            訂單日期 (P/I DATE):
          </label>
          <input
            type="text"
            value={order.piDate}
            onChange={(e) => updateField('piDate', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg font-mono focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-slate-600 font-semibold mb-1">
            客人出貨日 (SHIPMENT):
          </label>
          <input
            type="text"
            value={order.shipmentDate}
            onChange={(e) => updateField('shipmentDate', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg font-mono text-rose-700 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-slate-600 font-semibold mb-1">
            工廠中文採購單交期 (提前約15日):
          </label>
          <input
            type="text"
            value={order.factoryShipDate}
            onChange={(e) => updateField('factoryShipDate', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-rose-900 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-slate-600 font-semibold mb-1">
            貿易條件 (TERMS):
          </label>
          <input
            type="text"
            value={order.tradeTerms}
            onChange={(e) => updateField('tradeTerms', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-slate-600 font-semibold mb-1">
            付款條件 (PAYMENT):
          </label>
          <input
            type="text"
            value={order.paymentTerms}
            onChange={(e) => updateField('paymentTerms', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-slate-600 font-semibold mb-1">
            工廠供應商名稱:
          </label>
          <input
            type="text"
            value={order.factorySupplier}
            onChange={(e) => updateField('factorySupplier', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Items Section */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-800">
            款號明細與尺碼配比編輯 ({order.items.length} 款)
          </h4>
        </div>

        {order.items.map((item, itemIdx) => (
          <div key={item.id} className="border border-slate-300 rounded-xl p-4 bg-slate-50/50 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600 mb-0.5 block">
                  產品大類 / 款號 (ITEM NO.):
                </label>
                <input
                  type="text"
                  value={item.itemNo}
                  onChange={(e) => updateItem(itemIdx, { ...item, itemNo: e.target.value })}
                  className="w-full px-3 py-1.5 border rounded font-mono font-bold text-blue-900 bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 mb-0.5 block">
                  英文品名 (STYLE NAME):
                </label>
                <input
                  type="text"
                  value={item.styleName}
                  onChange={(e) => updateItem(itemIdx, { ...item, styleName: e.target.value })}
                  className="w-full px-3 py-1.5 border rounded font-semibold bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 mb-0.5 block">
                  中文品名 (工廠單):
                </label>
                <input
                  type="text"
                  value={item.chineseName}
                  onChange={(e) => updateItem(itemIdx, { ...item, chineseName: e.target.value })}
                  className="w-full px-3 py-1.5 border rounded font-bold text-slate-900 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-600 mb-0.5 block">
                    客人單價 (USD):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={item.unitPriceUSD}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      updateItem(itemIdx, {
                        ...item,
                        unitPriceUSD: val,
                        totalAmountUSD: item.totalQuantity * val,
                      });
                    }}
                    className="w-full px-2 py-1.5 border rounded font-mono font-bold text-right bg-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 mb-0.5 block">
                    工廠單價 (RMB):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={item.unitPriceRMB}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      updateItem(itemIdx, {
                        ...item,
                        unitPriceRMB: val,
                        totalAmountRMB: item.totalQuantity * val,
                      });
                    }}
                    className="w-full px-2 py-1.5 border rounded font-mono font-bold text-right bg-white text-amber-900"
                  />
                </div>
              </div>
            </div>

            {/* Spec & Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600 mb-0.5 block">
                  英文規格 (DESCRIPTION / COMPOSITION):
                </label>
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateItem(itemIdx, { ...item, description: e.target.value })}
                  className="w-full px-3 py-1.5 border rounded bg-white text-slate-700"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 mb-0.5 block">
                  中文面料與規格說明 (工廠單):
                </label>
                <input
                  type="text"
                  value={item.chineseSpec}
                  onChange={(e) => updateItem(itemIdx, { ...item, chineseSpec: e.target.value })}
                  className="w-full px-3 py-1.5 border rounded bg-white text-slate-800"
                />
              </div>
            </div>

            {/* Matrix table for this item */}
            <div className="overflow-x-auto bg-white p-3 rounded-lg border border-slate-200">
              <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                <span>尺寸配比矩陣 (件數)</span>
                <span className="text-[11px] font-mono text-blue-700">
                  小計: {item.totalQuantity.toLocaleString()} 件 | USD ${(item.totalQuantity * item.unitPriceUSD).toFixed(2)} | RMB ¥{(item.totalQuantity * item.unitPriceRMB).toFixed(2)}
                </span>
              </div>
              <table className="w-full text-xs text-center border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold border-b">
                    <th className="p-1.5 text-left pl-2">顏色代碼 / 名稱</th>
                    {item.sizes.map((s) => (
                      <th key={s} className="p-1.5 font-mono">{s}</th>
                    ))}
                    <th className="p-1.5 font-mono bg-slate-200/60">小計</th>
                  </tr>
                </thead>
                <tbody>
                  {item.colors.map((c, colorIdx) => (
                    <tr key={c.id} className="border-b hover:bg-slate-50">
                      <td className="p-1.5 text-left pl-2 font-medium text-slate-800 font-mono">
                        {c.colorCode} - {c.colorName}
                      </td>
                      {item.sizes.map((s) => (
                        <td key={s} className="p-1">
                          <input
                            type="number"
                            min="0"
                            value={c.quantitiesBySize[s] || 0}
                            onChange={(e) =>
                              handleQuantityChange(
                                itemIdx,
                                colorIdx,
                                s,
                                parseInt(e.target.value, 10) || 0
                              )
                            }
                            className="w-16 px-1.5 py-1 border rounded text-center font-mono font-semibold"
                          />
                        </td>
                      ))}
                      <td className="p-1.5 font-mono font-bold text-slate-900 bg-slate-50">
                        {c.totalQuantity.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
