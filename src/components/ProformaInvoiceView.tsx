import React from 'react';
import { OrderData } from '../types/order';
import { amountToEnglishWords } from '../utils/numberToWords';
import { Download, FileSpreadsheet, Check } from 'lucide-react';
import {
  exportOrderToExcel,
  exportSimpleProductExcel,
  exportProformaInvoiceExcel,
} from '../utils/excelExport';
import { groupColorsByRatio } from '../utils/ratioGrouping';

interface Props {
  order: OrderData;
  highlightedField?: string;
  onFieldClick?: (fieldName: string) => void;
}

export const ProformaInvoiceView: React.FC<Props> = ({ order, highlightedField, onFieldClick }) => {
  const totalPieces = order.items.reduce((acc, item) => {
    return acc + item.colors.reduce((cSum, c) => cSum + c.totalQuantity, 0);
  }, 0);

  const totalAmountUSD = order.items.reduce((acc, item) => {
    const itemQty = item.colors.reduce((cSum, c) => cSum + c.totalQuantity, 0);
    return acc + itemQty * item.unitPriceUSD;
  }, 0);

  const sayTotalWords = amountToEnglishWords(totalAmountUSD);
  const company = order.companyHeader || {
    name: 'SPORTS KITE INTERNATIONAL CO., LTD.',
    address: '7F., No. 522, Sec. 5, Zhongshan N. Rd., Shilin Dist., Taipei City 111005 , Taiwan (R.O.C.)',
    tel: '886-2-2763-5455',
    fax: '886-2-2763-5177',
    web: 'www.sportskite.com.tw',
    managerDirector: 'Giant Kao',
  };

  const getHighlightClass = (field: string) => {
    return highlightedField === field
      ? 'bg-amber-100 ring-2 ring-amber-400 font-semibold transition-all duration-200'
      : 'hover:bg-blue-50/60 cursor-pointer transition-colors';
  };

  return (
    <div className="bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden text-slate-800 font-sans">
      {/* Top Action Bar */}
      <div className="bg-slate-100/90 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          <span className="font-bold text-slate-800 text-sm tracking-wide">
            PROFORMA INVOICE (P/I) - 100% 依據您提供的實際發票格式渲染
          </span>
          <span className="text-[11px] bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded-full border border-blue-200">
            {order.packingType || 'MULTIPLE PACK'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportSimpleProductExcel(order)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
            title="導出指定 5 欄格式 Excel (產品編號/客戶產品編號/數量/金額/組合數量)"
          >
            <Download className="w-4 h-4 text-teal-200" />
            導出 5 欄清單
          </button>
          <button
            onClick={() => exportProformaInvoiceExcel(order)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
            title="僅導出單獨的英文 P/I Excel 檔案 (單一檔案，無工作表2)"
          >
            <Download className="w-4 h-4" />
            導出 P/I 獨立 Excel
          </button>
          <button
            onClick={() => exportOrderToExcel(order)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
            title="依序下載 2 個獨立 Excel 檔案 (P/I 檔與採購單檔各 1 個，不放在同檔 Sheet1/Sheet2)"
          >
            <Download className="w-4 h-4" />
            一鍵導出兩檔 (分開2個Excel)
          </button>
        </div>
      </div>

      {/* Spreadsheet Paper container - Matching User's PDF Page 1 */}
      <div className="p-4 md:p-8 overflow-x-auto bg-slate-200/60 flex justify-center">
        <div className="w-full max-w-[960px] bg-white border border-slate-300 p-8 md:p-12 shadow-md text-slate-900 font-sans text-xs leading-relaxed">
          {/* 1. Letterhead */}
          <div className="text-center relative pb-3 border-b-2 border-slate-900">
            <div className="absolute right-0 top-0 text-[11px] font-mono text-slate-700">
              PAGE: 1OF 2
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-wider text-slate-900 font-serif">
              {company.name}
            </h1>
            <p className="text-[11px] text-slate-600 mt-1">
              {company.address}
            </p>
            <p className="text-[11px] text-slate-600 font-mono mt-0.5">
              TEL: {company.tel} &nbsp;&nbsp; FAX: {company.fax} &nbsp;&nbsp; {company.web}
            </p>
            <div className="mt-3">
              <span className="text-lg font-bold tracking-widest uppercase border-b-2 border-slate-900 pb-0.5 inline-block">
                PROFORMA INVOICE
              </span>
            </div>
          </div>

          {/* 2. Top Header Meta (Left / Right) */}
          <div className="grid grid-cols-12 gap-4 py-4 border-b border-slate-300 text-xs">
            {/* Left Buyer & Bank Info */}
            <div className="col-span-7 space-y-1">
              <div
                className={`p-1 rounded ${getHighlightClass('customerName')}`}
                onClick={() => onFieldClick?.('customerName')}
              >
                <span className="font-bold text-slate-700">MESSRS.: </span>
                <span className="font-bold text-slate-900 ml-2">{order.customerName}</span>
              </div>

              <div className="pt-2 space-y-1">
                <div
                  className={`p-1 rounded ${getHighlightClass('paymentTerms')}`}
                  onClick={() => onFieldClick?.('paymentTerms')}
                >
                  <span className="font-bold text-slate-700">PAYMENT: </span>
                  <span className="font-mono text-slate-800">{order.paymentTerms}</span>
                </div>

                <div className="text-[11px] font-mono pl-3 text-slate-700 space-y-0.5">
                  <div className="font-bold text-slate-900">"{order.bankInfo.beneficiary}"</div>
                  <div>{order.bankInfo.bankName}</div>
                  <div>{order.bankInfo.address}</div>
                  <div className="font-bold text-slate-900">ACCOUNT NO. {order.bankInfo.accountNo}</div>
                  <div className="font-bold text-slate-900">SWIFT ADD: {order.bankInfo.swiftCode}</div>
                </div>

                <div
                  className={`p-1 rounded font-semibold ${getHighlightClass('shipmentDate')}`}
                  onClick={() => onFieldClick?.('shipmentDate')}
                >
                  <span className="text-slate-700 font-bold">SHIPMENT: </span>
                  <span className="font-mono text-slate-900">{order.shipmentDate}</span>
                </div>

                <div
                  className={`p-1 rounded ${getHighlightClass('tradeTerms')}`}
                  onClick={() => onFieldClick?.('tradeTerms')}
                >
                  <span className="text-slate-700 font-bold">TERMS: </span>
                  <span className="font-mono text-slate-900">{order.tradeTerms}</span>
                </div>

                <div className="text-[11px] text-slate-600 pl-1 pt-1 space-y-0.5">
                  <div className="font-bold text-slate-700">REMARK :</div>
                  {order.remarks.map((r, i) => (
                    <div key={i} className="pl-3">{r}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Meta Block with MULTIPLE PACK BOX */}
            <div className="col-span-5 flex flex-col justify-between pl-4 border-l border-slate-200">
              <div className="space-y-1.5 font-mono text-xs">
                <div
                  className={`p-1 rounded ${getHighlightClass('piDate')}`}
                  onClick={() => onFieldClick?.('piDate')}
                >
                  <span className="text-slate-600 font-sans font-bold">DATE: </span>
                  <span className="font-bold text-slate-900">{order.piDate}</span>
                </div>

                <div
                  className={`p-1 rounded ${getHighlightClass('piNumber')}`}
                  onClick={() => onFieldClick?.('piNumber')}
                >
                  <span className="text-slate-600 font-sans font-bold">P/I NO.: </span>
                  <span className="font-bold text-slate-900">{order.piNumber}</span>
                </div>

                <div
                  className={`p-1 rounded ${getHighlightClass('poNumber')}`}
                  onClick={() => onFieldClick?.('poNumber')}
                >
                  <span className="text-slate-600 font-sans font-bold">CISALFA'S ORDER NO.: </span>
                  <span className="font-bold text-slate-900">{order.poNumber}</span>
                </div>

                <div className="p-1">
                  <span className="text-slate-600 font-sans font-bold">CUST#: </span>
                  <span className="font-bold text-slate-900">{order.customerCode}</span>
                </div>
              </div>

              {/* PACKAGING TYPE BOX */}
              <div className="mt-4 pt-2">
                <div className="border-2 border-slate-900 p-2 text-center font-bold text-slate-900 tracking-widest text-xs bg-slate-50 uppercase">
                  {order.packingType || 'MULTIPLE PACK'}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Items Table Header */}
          <div className="mt-4">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-slate-900 text-left font-bold text-slate-900">
                  <th className="py-2 pr-2 w-10">SEP.</th>
                  <th className="py-2 px-2 w-36">ITEM NO.</th>
                  <th className="py-2 px-2">DESCRIPTION</th>
                  <th className="py-2 px-2 text-right w-28">QUANTITY<br />(PCS)</th>
                  <th className="py-2 px-2 text-right w-28">UNIT PRICE<br />(USD)</th>
                  <th className="py-2 pl-2 text-right w-32">AMOUNT<br />(USD)</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, idx) => {
                  const itemQty = item.colors.reduce((sum, c) => sum + c.totalQuantity, 0);
                  const unitPrice = item.unitPriceUSD || 0;
                  const itemAmt = itemQty * unitPrice;

                  return (
                    <React.Fragment key={item.id}>
                      {/* Main Item Line */}
                      <tr className="border-t border-slate-300">
                        <td className="py-2 pr-2 font-mono font-bold align-top">
                          {idx + 1}.
                        </td>
                        <td
                          className={`py-2 px-2 font-mono font-bold text-slate-900 align-top ${getHighlightClass('itemNo')}`}
                          onClick={() => onFieldClick?.('itemNo')}
                        >
                          {item.itemNo}
                        </td>
                        <td className="py-2 px-2 align-top">
                          <div className="font-bold text-slate-900">{item.styleName}</div>
                          <div className="text-slate-700 mt-0.5">{item.description}</div>
                          <div className="text-slate-800 font-mono mt-0.5">
                            SIZE: {item.sizes.join('/ ')}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-900 align-top">
                          {itemQty.toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-semibold align-top">
                          {unitPrice.toFixed(2)}
                        </td>
                        <td className="py-2 pl-2 text-right font-mono font-bold text-slate-900 align-top">
                          {itemAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>

                      {/* Sub-tables: Color Combination & Color/Size Matrix */}
                      <tr>
                        <td></td>
                        <td colSpan={5} className="py-3 pr-2">
                          <div className="space-y-4 max-w-xl">
                            {/* Table 1: COLOR COMBINATION */}
                            <table className="border-collapse border-2 border-slate-900 text-[11px] text-center w-full">
                              <thead>
                                <tr className="border-b border-slate-900 font-bold bg-slate-50">
                                  <th className="border-r border-slate-900 p-1 w-36 text-slate-700">
                                    COLOR COMBINATION
                                  </th>
                                  {item.colors.map((c) => (
                                    <th key={c.id} className="border-r last:border-r-0 border-slate-900 p-1 font-mono font-bold">
                                      {c.colorCode}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-b border-slate-900">
                                  <td className="border-r border-slate-900 p-1 font-bold text-slate-700 text-left pl-2">
                                    COLOR(1)
                                  </td>
                                  {item.colors.map((c) => (
                                    <td key={c.id} className="border-r last:border-r-0 border-slate-900 p-1 font-medium text-slate-900 text-center">
                                      {c.colorName}
                                    </td>
                                  ))}
                                </tr>
                                <tr className="font-bold font-mono">
                                  <td className="border-r border-slate-900 p-1 text-slate-700 text-left pl-2 font-sans">
                                    QUANTITY
                                  </td>
                                  {item.colors.map((c) => (
                                    <td key={c.id} className="border-r last:border-r-0 border-slate-900 p-1 text-slate-900 text-center">
                                      {c.totalQuantity.toLocaleString()}
                                    </td>
                                  ))}
                                </tr>
                              </tbody>
                            </table>

                            {/* Table 2: COLOR / SIZE MATRIX (PACK RATIO DIRECTLY UNDER SIZE - GROUPED BY RATIO!) */}
                            <table className="border-collapse border-2 border-slate-900 text-[11px] text-center w-full">
                              <thead>
                                <tr className="border-b border-slate-900 font-bold bg-slate-50">
                                  <th rowSpan={2} className="border-r border-slate-900 p-1.5 w-44 text-slate-800 text-left pl-2 align-middle font-sans">
                                    COLOR / SIZE
                                  </th>
                                  <th colSpan={item.sizes.length} className="border-r border-slate-900 p-1 border-b border-slate-900 font-sans">
                                    SIZE
                                  </th>
                                  <th rowSpan={2} className="p-1.5 w-28 align-middle font-sans font-bold">
                                    TOTAL<br />(PCS)
                                  </th>
                                </tr>
                                <tr className="border-b border-slate-900 font-bold bg-slate-50">
                                  {item.sizes.map((s) => (
                                    <th key={s} className="border-r border-slate-900 p-1 font-mono min-w-[42px]">
                                      {s}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  if (order.packingType !== 'MULTIPLE PACK') {
                                    return item.colors.map((c) => (
                                      <tr key={c.id} className="border-b last:border-b-0 border-slate-900 hover:bg-slate-50">
                                        <td className="border-r border-slate-900 p-1 text-left pl-2 font-medium text-slate-900">
                                          {c.colorName}
                                        </td>
                                        {item.sizes.map((s) => (
                                          <td key={s} className="border-r border-slate-900 p-1 font-mono text-slate-900">
                                            {(c.quantitiesBySize[s] ?? 0).toLocaleString()}
                                          </td>
                                        ))}
                                        <td className="p-1 font-mono font-bold text-slate-900">
                                          {c.totalQuantity.toLocaleString()}
                                        </td>
                                      </tr>
                                    ));
                                  }

                                  // 混碼配比分組：「如有不同的, 同一個數量的配比放一起, 再依序往下列」
                                  const ratioGroups = groupColorsByRatio(item.colors, item.sizes);

                                  return ratioGroups.map((group, gIdx) => (
                                    <React.Fragment key={group.ratioKey || gIdx}>
                                      {/* PACK RATIO ROW FOR THIS GROUP (放在 SIZE 下面) */}
                                      <tr className="border-b-2 border-slate-900 bg-purple-50 text-purple-950 font-bold">
                                        <td className="border-r border-slate-900 p-1 text-left pl-2 text-purple-900 font-semibold text-[10.5px]">
                                          PACK RATIO ({group.piecesPerPack} PCS/PACK)
                                        </td>
                                        {item.sizes.map((s) => {
                                          const pRatio = group.ratioBySize[s] !== undefined ? group.ratioBySize[s] : '-';
                                          return (
                                            <td key={s} className="border-r border-slate-900 p-1 font-mono font-bold text-purple-900">
                                              {pRatio}
                                            </td>
                                          );
                                        })}
                                        <td className="p-1 font-mono font-bold text-purple-950 bg-purple-100/70 text-[10.5px]">
                                          {group.piecesPerPack} PCS/PACK
                                        </td>
                                      </tr>

                                      {/* Color Rows belonging to this ratio */}
                                      {group.colors.map((c) => (
                                        <tr key={c.id} className="border-b border-slate-900 hover:bg-slate-50">
                                          <td className="border-r border-slate-900 p-1 text-left pl-2 font-medium text-slate-900">
                                            {c.colorName}
                                          </td>
                                          {item.sizes.map((s) => {
                                            const q = c.quantitiesBySize[s] ?? 0;
                                            return (
                                              <td key={s} className="border-r border-slate-900 p-1 font-mono text-slate-900">
                                                {q.toLocaleString()}
                                              </td>
                                            );
                                          })}
                                          <td className="p-1 font-mono font-bold text-slate-900">
                                            {c.totalQuantity.toLocaleString()}
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
                    </React.Fragment>
                  );
                })}
              </tbody>

              {/* Total Footer */}
              <tfoot>
                <tr className="border-t-2 border-b-2 border-slate-900 font-bold text-slate-900">
                  <td colSpan={3} className="py-2.5 font-bold tracking-wider">
                    TOTAL:
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-sm">
                    {totalPieces.toLocaleString()} PCS
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono">
                    USD
                  </td>
                  <td className="py-2.5 pl-2 text-right font-mono text-sm font-extrabold">
                    {totalAmountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Say Total Words */}
          <div className="mt-4 py-2 font-bold font-mono text-xs text-slate-900 tracking-tight">
            {sayTotalWords}
          </div>

          {/* Signatures Block - Matching User's PDF Bottom */}
          <div className="pt-10 mt-6 flex justify-between items-end text-xs font-bold text-slate-900">
            <div>
              <div className="pb-12 text-slate-800">
                {order.customerName}
              </div>
              <div className="border-t border-slate-400 pt-1 text-[11px] font-normal text-slate-500">
                (PLEASE KINDLY SIGN BACK ,THANKS!!)
              </div>
            </div>

            <div className="text-right">
              <div className="pb-2 text-slate-800">
                {company.name}
              </div>
              <div className="italic text-base font-serif font-normal text-slate-600 pr-4 pb-2">
                Giant Kao
              </div>
              <div className="border-t border-slate-400 pt-1 text-[11px] font-normal text-slate-500">
                ( Manager Director: {company.managerDirector} )
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
