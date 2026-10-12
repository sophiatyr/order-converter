import ExcelJS from 'exceljs';
import type { OrderData, OrderItem } from '../types/order';
import { csqIssues } from './csqAccount';
import { erpFactoryOrders } from './erpProducts';
import { findCsqReference, type CsqReference } from './csqReferences';
import { saveWorkbookToFile } from './excelExport';

function sheet(book: ExcelJS.Workbook, name: string, widths: number[]) {
  const ws = book.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 7 }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = widths.map(width => ({ width }));
  return ws;
}
function finish(ws: ExcelJS.Worksheet, headerRows: number[]) {
  ws.eachRow(row => {
    row.height = 30;
    row.eachCell(cell => {
      cell.font = { name: 'Microsoft JhengHei', size: 10 };
      cell.alignment = { vertical: 'middle', wrapText: true };
      if (typeof cell.value === 'number' || cell.type === ExcelJS.ValueType.Formula) cell.numFmt = '#,##0.##';
    });
  });
  for (const index of headerRows) ws.getRow(index).eachCell(cell => {
    cell.font = { name: 'Microsoft JhengHei', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF32786B' } };
  });
  ws.pageSetup.printArea = `A1:${ws.getColumn(ws.columnCount).letter}${ws.rowCount}`;
  ws.headerFooter.oddFooter = 'CSQ 工作站 &C第 &P 頁／共 &N 頁';
}
const qSum = (item: OrderItem) => item.colors.reduce((sum, c) => sum + Object.values(c.quantitiesBySize).reduce((a, b) => a + b, 0), 0);
function addChecks(book: ExcelJS.Workbook, order: OrderData, references: CsqReference[]) {
  const ws = sheet(book, '資料核對', [23, 23, 23, 65]);
  ws.addRow(['核對項目', '明細計算', '對照數值', '結果／來源']);
  const quantity = order.items.reduce((sum, i) => sum + qSum(i), 0);
  const amount = order.items.reduce((sum, i) => sum + i.totalQuantity * i.unitPriceUSD, 0);
  ws.addRow(['尺碼加總／PO 品項總量', quantity, order.totalPieces, quantity === order.totalPieces ? '一致' : '不一致，請核對尺碼']);
  ws.addRow(['數量／原始 PO 印列', order.totalPieces, order.sourcePrintedQuantity ?? '', order.sourcePrintedQuantity === undefined ? '原始 PO 未提供總量，待人工核對' : order.totalPieces === order.sourcePrintedQuantity ? '一致' : '不一致']);
  ws.addRow(['客戶金額 USD／原始 PO', amount, order.sourcePrintedAmount ?? '', order.sourcePrintedAmount === undefined ? '原始 PO 未提供金額，待人工核對' : Math.abs(amount - order.sourcePrintedAmount) < 0.01 ? '一致' : '不一致']);
  for (const item of order.items) {
    ws.addRow([item.itemNo, qSum(item), item.totalQuantity, qSum(item) === item.totalQuantity ? '尺碼合計一致' : '尺碼合計不一致']);
    const ref = findCsqReference(item.itemNo, order.poNumber, references);
    ws.addRow(['成份來源', item.itemNo, ref ? '參考採購單' : '客人原始 PO', ref ? `${ref.sourceFile} / ${ref.sheet} / 第 ${ref.row} 列` : '沒有可確認的相同款號成份，保留原始 PO 說明']);
  }
  for (const issue of csqIssues(order)) ws.addRow(['待核對', '', '', issue]);
  ws.addRow(['訂單來源', order.sourceFileName || '本機保存的訂單', '', order.poNumber]);
  finish(ws, [1]);
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}
function groups(order: OrderData, factory = false) {
  const result = new Map<string, OrderItem[]>();
  for (const item of order.items) {
    const key = JSON.stringify([item.itemNo, factory ? item.factoryProduct?.price : item.unitPriceUSD, !!item.isPrepack]);
    result.set(key, [...(result.get(key) || []), item]);
  }
  return [...result.values()];
}
export function buildQuantityDetails(order: OrderData, references: CsqReference[] = []) {
  const book = new ExcelJS.Workbook();
  groups(order).forEach((items, index) => {
    const first = items[0];
    const sizes = [...new Set(items.flatMap(i => [...i.sizes, ...i.colors.flatMap(c => Object.keys(c.quantitiesBySize))]))];
    const ws = sheet(book, `${index + 1}-${first.itemNo}`.replace(/[\\/?*\[\]:]/g, '_').slice(0, 31), [15, 32, 24, ...sizes.map(() => 10), 14, 14, 28]);
    const end = 3 + sizes.length + 3;
    ws.mergeCells(1, 1, 1, end); ws.getCell('A1').value = 'CSQ 顏色數量明細';
    ws.addRow(['S/C 號碼', order.piNumber, '客人 PO', order.poNumber]);
    ws.addRow(['款號', first.itemNo, '客戶品名', first.styleName]);
    ws.addRow(['客戶交期', order.shipmentDate, '工廠交期', order.factoryShipDate]);
    const ref = findCsqReference(first.itemNo, order.poNumber, references);
    ws.mergeCells(5, 2, 5, end); ws.getCell('A5').value = '布種／成份'; ws.getCell('B5').value = ref?.spec || first.description;
    ws.getRow(5).height = 65;
    ws.addRow(['包裝方式', first.isPrepack ? '混碼包裝（比例見備註）' : '單色單碼']);
    ws.addRow(['顏色代碼', '顏色', '客戶產品編號', ...sizes, '尺碼合計', 'PO 數量', '包裝比例／核對']);
    let sumSizes = 0, sumPo = 0;
    const sizeTotals = sizes.map(() => 0);
    for (const item of items) for (const color of item.colors) {
      const quantities = sizes.map((s, n) => { const q = color.quantitiesBySize[s] || 0; sizeTotals[n] += q; return q; });
      const sum = quantities.reduce((a, b) => a + b, 0);
      const row = ws.addRow([color.colorCode, color.colorName, (item.customerItemCodes || []).join(' / '), ...quantities, sum, color.totalQuantity,
        `${sum === color.totalQuantity ? '一致' : '⚠ 尺碼合計不符'}${item.isPrepack ? `；${color.ratioString || item.ratioString || '比例待確認'}` : ''}`]);
      if (sizes.length) row.getCell(4 + sizes.length).value = { formula: `SUM(D${row.number}:${ws.getColumn(3 + sizes.length).letter}${row.number})`, result: sum };
      sumSizes += sum; sumPo += color.totalQuantity;
    }
    const total = ws.addRow(['合計', '', '', ...sizeTotals, sumSizes, sumPo, sumSizes === sumPo ? '一致' : '⚠ 不一致']);
    for (let col = 4; col <= 5 + sizes.length; col++) total.getCell(col).value = { formula: `SUM(${ws.getColumn(col).letter}8:${ws.getColumn(col).letter}${total.number - 1})`, result: Number(total.getCell(col).value) };
    ws.autoFilter = { from: 'A7', to: { row: total.number - 1, column: end } };
    finish(ws, [7, total.number]); ws.getRow(5).height = 65;
    ws.pageSetup.printTitlesRow = '1:7';
  });
  addChecks(book, order, references);
  return book;
}
export function buildQuickOverview(order: OrderData, references: CsqReference[] = []) {
  const book = new ExcelJS.Workbook();
  const ws = sheet(book, '早見表', [7, 24, 30, 14, 12, 15, 18, 22, 25, 28]);
  ws.mergeCells('A1:J1'); ws.getCell('A1').value = 'CSQ 訂單早見表';
  const metadata = [
    ['CUSTOMER', order.customerName, 'S/C NO.', order.piNumber],
    ['DATE', order.poDate, 'CUST. P/O NO.', order.poNumber],
    ['PAYMENT', order.paymentTerms, 'TERM', order.tradeTerms],
    ['SHIPMENT', order.shipmentDate, 'PACKING', order.packingType || 'NORMAL PACK'],
  ];
  metadata.forEach((values, index) => {
    const r = index + 2;
    for (const [start, end] of [[1, 2], [3, 5], [6, 7], [8, 10]]) ws.mergeCells(r, start, r, end);
    [1, 3, 6, 8].forEach((col, n) => { ws.getCell(r, col).value = values[n]; });
  });
  ws.mergeCells('A6:J6'); ws.getCell('A6').value = '客戶訂單（售價 USD；数量沿用 PO，手套 ABCRA07 為雙）';
  ws.addRow(['序號', '款號', '客戶品名', '數量', '單位', '單價 USD', 'S/C 金額 USD', '工廠代碼', '工廠交期', '包裝']);
  groups(order).forEach((items, index) => {
    const first = items[0], quantity = items.reduce((sum, i) => sum + i.totalQuantity, 0);
    const row = ws.addRow([index + 1, first.itemNo, first.styleName, quantity, first.itemNo.toUpperCase() === 'ABCRA07' ? '雙' : '件', first.unitPriceUSD, quantity * first.unitPriceUSD,
      [...new Set(items.map(i => i.factoryProduct?.supplierCode).filter(Boolean))].join(' / ') || '', order.factoryShipDate, first.isPrepack ? '混碼包裝' : '單色單碼']);
    row.getCell(7).value = { formula: `D${row.number}*F${row.number}`, result: quantity * first.unitPriceUSD };
  });
  const last = ws.rowCount;
  const total = ws.addRow(['GRAND TOTAL', '', '', order.totalPieces, 'PO 數量', '', order.items.reduce((s, i) => s + i.totalQuantity * i.unitPriceUSD, 0)]);
  total.getCell(4).value = { formula: `SUM(D8:D${last})`, result: order.totalPieces };
  total.getCell(7).value = { formula: `SUM(G8:G${last})`, result: order.items.reduce((s, i) => s + i.totalQuantity * i.unitPriceUSD, 0) };
  ws.mergeCells(total.number, 1, total.number, 3);
  ws.addRow([]);
  const factoryHeader = ws.addRow(['工廠採購彙總', '款號', '供應商', '採購數量', '單位', '採購單價', '採購金額', '幣別', '報價日期', '成份來源']);
  const factoryGroups = erpFactoryOrders(order);
  for (const group of factoryGroups) {
    let amount = 0;
    for (const items of groups(group.order, true)) {
      const item = items[0];
      const quantity = items.reduce((sum, i) => sum + i.totalQuantity, 0);
      const quote = item.factoryProduct!;
      const ref = findCsqReference(item.itemNo, order.poNumber, references);
      const row = ws.addRow([group.order.supplierCode, item.itemNo, quote.supplier, quantity, quote.unit, quote.price, quantity * quote.price, quote.currency, quote.quoteDate, ref ? '參考採購單' : '客人原始 PO']);
      row.getCell(7).value = { formula: `D${row.number}*F${row.number}`, result: quantity * quote.price };
      amount += quantity * quote.price;
    }
    ws.addRow(['工廠小計', group.order.supplierCode, group.order.factorySupplier, group.order.totalPieces, group.order.factoryQuantityUnit, '', amount, group.order.factoryCurrency]);
  }
  const pending = order.items.filter(i => !i.factoryProduct);
  if (pending.length) {
    const row = ws.addRow(['待核對報價', `${pending.map(i => i.itemNo).join(' / ')}：尚未帶入或確認 ERP 工廠報價；不計入採購金額`]);
    ws.mergeCells(row.number, 2, row.number, 10);
  }
  finish(ws, [7, total.number, factoryHeader.number]);
  ws.getColumn(6).numFmt = '#,##0.00'; ws.getColumn(7).numFmt = '#,##0.00';
  ws.getRow(4).height = 60;
  ws.getRow(factoryHeader.number).height = 50;
  if (pending.length) ws.getRow(ws.rowCount).height = 55;
  ws.pageSetup.printTitlesRow = '1:7';
  addChecks(book, order, references);
  return book;
}
export async function exportQuantityDetails(order: OrderData, references: CsqReference[] = []) {
  return saveWorkbookToFile(buildQuantityDetails(order, references), `${order.piNumber || order.poNumber}_數量明細表.xlsx`);
}
export async function exportQuickOverview(order: OrderData, references: CsqReference[] = []) {
  return saveWorkbookToFile(buildQuickOverview(order, references), `${order.piNumber || order.poNumber}_早見表.xlsx`);
}
