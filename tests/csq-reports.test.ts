import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { parseTextToOrder } from '../src/utils/localPoParser';
import { normalizeCsqOrder, factoryDocument } from '../src/utils/csqAccount';
import { findCsqReference, type CsqReference } from '../src/utils/csqReferences';
import { buildQuantityDetails, buildQuickOverview } from '../src/utils/csqReports';

// Values checked against customer PO and the color rows of CS26000337 PO副.
const input = 'Order number\t26OF000337\nItem\tColor Code\tColor\tXS\tS\tM\tL\tXL\tXXL\tQty\tPrice\n' + [
  ['ABCRM1039W26','050','BLACK',0,80,190,210,110,60,650,2.1],
  ['ABCRM1039W26','237','FLAME',0,50,100,130,70,50,400,2.1],
  ['ABCRM1039W26','627','TAPESTRY',0,50,150,170,80,50,500,2.1],
  ['ABCRW1036W26','050','BLACK',60,170,200,110,60,0,600,2],
  ['ABCRW1036W26','1136','TOFU',50,100,130,70,50,0,400,2],
  ['ABCRW1036W26','437','JACARANDA',50,100,130,70,50,0,400,2],
].map(r => r.join('\t')).join('\n');
const parsed = parseTextToOrder(input);
assert.ok(parsed.order, parsed.error);
const order = normalizeCsqOrder({ ...parsed.order, sourcePrintedQuantity: 2950, sourcePrintedAmount: 6055,
  items: parsed.order.items.map(i => ({...i, description: '100% POLYESTER SMALL NEEDLE WITH DRY FIT', chineseSpec: 'ERP specification must not replace original PO fallback'})) });
const ref: CsqReference = { style: 'ABCRM1039W26', name: 'ABC男士短袖', spec: '全涤 75D/72F針點布；布重135GM/M2', poNumbers: ['26OF000337'], sourceFile: '工廠採購單/337.xls', sheet: '各队', row: 18 };
assert.equal(findCsqReference('ABCRM1039', order.poNumber, [ref]), undefined);
assert.equal(findCsqReference(ref.style, order.poNumber, [ref, {...ref, poNumbers: ['OTHER'], spec: '不同布種'}]), ref);
assert.equal(findCsqReference(ref.style, 'UNKNOWN', [ref, {...ref, spec: '不同布種'}]), undefined);
const factory = factoryDocument(order, [ref]);
assert.equal(factory.items[0].chineseSpec, order.items[0].description+'\n'+ref.spec);
assert.equal(factory.items.at(-1)!.chineseSpec, order.items.at(-1)!.description);
assert.equal(order.items[0].unitPriceUSD, 2.1);
const details = buildQuantityDetails(order, [ref]);
assert.equal(details.worksheets.length, 3);
const male = details.worksheets[0];
const header = male.getRow(7).values as string[];
const sColumn = header.indexOf('S');
assert.equal((male.getRow(male.rowCount).getCell(sColumn).value as ExcelJS.CellFormulaValue).result, 180);
assert.equal((male.getRow(male.rowCount).getCell(header.indexOf('尺碼合計')).value as ExcelJS.CellFormulaValue).result, 1550);
const overview = buildQuickOverview(order, [ref]);
assert.equal(overview.worksheets[0].getCell('D8').value, 1550);
assert.equal(overview.worksheets[0].getCell('D9').value, 1400);
assert.equal((overview.worksheets[0].getCell('G10').value as ExcelJS.CellFormulaValue).result, 6055);
const withQuotes = {...order, erpFactoryApplied: true, items: order.items.map(i => ({...i,
  factoryProduct: {supplier: '雷諾斯', supplierCode: 'LA', currency: 'RMB' as const, price: i.itemNo === 'ABCRM1039W26' ? 12.5 : 11.5, unit: '件', quoteDate: '2026-01-12'} }))};
const factoryOverview = buildQuickOverview(withQuotes).worksheets[0];
const rows: ExcelJS.CellValue[][] = [];
factoryOverview.eachRow(r => rows.push((r.values as ExcelJS.CellValue[]).slice(1)));
const subtotal = rows.find(r => r[0] === '工廠小計')!;
assert.equal(subtotal[3], 2950);
assert.equal(subtotal[6], 35475);
assert.equal(subtotal[7], 'RMB');
assert.equal((factoryOverview.getCell('G10').value as ExcelJS.CellFormulaValue).result, 6055);
assert.equal(rows.filter(r => r[0] === 'LA' && /^ABCR/.test(String(r[1]))).length, 2);
for (const book of [details, overview]) {
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await book.xlsx.writeBuffer());
  assert.equal(restored.worksheets.length, book.worksheets.length);
  const checks = restored.getWorksheet('資料核對')!;
  assert.equal(checks.getCell('D2').value, '一致');
  assert.equal(checks.getCell('D3').value, '一致');
  assert.equal(checks.getCell('D4').value, '一致');
}
const incorrect = buildQuantityDetails({...order, items: order.items.map((i, n) => n ? i : {...i, colors: i.colors.map((c, index) => index ? c : {...c, quantitiesBySize: {...c.quantitiesBySize, S: 999}})})});
assert.equal(incorrect.getWorksheet('資料核對')!.getCell('D2').value, '不一致，請核對尺碼');
console.log('PASS: CSQ reports, all-color size totals, customer amounts, exact reference composition and PO fallback, XLSX round trip, mismatch checks.');
