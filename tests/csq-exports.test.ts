import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { parseTextToOrder } from '../src/utils/localPoParser';
import { factoryDocument, normalizeCsqOrder } from '../src/utils/csqAccount';
import { buildProformaInvoiceSheet, buildFactoryPOSheet } from '../src/utils/excelExport';

const parsed = parseTextToOrder('Order number\t26OF000003\nItem\tColor Code\tColor\tS\tM\tQty\tPrice\nTEST01\t050\tBLACK\t100\t155\t255\t4.60');
assert.ok(parsed.order);
const order = normalizeCsqOrder({ ...parsed.order, factorySupplier: 'TEST FACTORY', factoryCurrency: 'USD', items: parsed.order.items.map(item => ({ ...item, factoryUnitPriceUSD: 2 })) });
for (const kind of ['pi','factory'] as const) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(kind);
  if (kind === 'pi') buildProformaInvoiceSheet(sheet, order);
  else buildFactoryPOSheet(sheet, factoryDocument(order), { poCurrency: 'USD' });
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await workbook.xlsx.writeBuffer());
  const values: unknown[] = [];
  restored.worksheets[0].eachRow(row => row.eachCell(cell => values.push(cell.value)));
  assert.equal(restored.worksheets.length,1);
  assert.ok(values.some(value => typeof value === 'string' && value.includes('CS26000003')));
  assert.ok(values.includes(255));
  assert.ok(values.includes(kind === 'pi' ? 4.6 : 2));
  assert.ok(values.includes(kind === 'pi' ? 1173 : 510));
}
assert.equal(order.items[0].unitPriceUSD,4.6);
console.log('PASS: P/I and factory XLSX round trip, matching quantities, independent sale price and factory cost.');
