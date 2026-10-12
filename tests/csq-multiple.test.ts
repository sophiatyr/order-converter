import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseGridToOrder, parseTextToOrder } from '../src/utils/localPoParser';

// Independent expected values come from SK-KPI's coordinate-based Python parser
// running against the original PDFs; input rows come from the browser PDF reader.
const expected = JSON.parse(fs.readFileSync('tests/fixtures/csq-multiple-sk-kpi-expected.json', 'utf8'));
const fixture = (no: string): string[][] => JSON.parse(fs.readFileSync(`tests/fixtures/csq-multiple-${no}-rows.json`, 'utf8'));
const colorName = (name: string) => name.replace(/\s*-\s*/g, '-').replace(/(?<=\d)\s+(?=\d)/g, '');
for (const no of ['029920', '029925', '029929', '029930']) {
  const rows = fixture(no), reference = expected[no];
  for (const result of [parseGridToOrder(rows), parseTextToOrder(rows.map(row => row.join('\t')).join('\n'))]) {
    assert.equal(result.success, true, result.error);
    assert.deepEqual(result.warnings, []);
    const order = result.order!;
    assert.equal(order.poNumber, `26OF${no}`);
    assert.equal(order.packingType, 'MULTIPLE PACK');
    assert.equal(order.totalKits, reference.packs);
    assert.equal(order.sourcePrintedPackQuantity, reference.packs);
    assert.equal(order.sourcePrintedQuantity, undefined);
    assert.equal(order.totalPieces, reference.pieces);
    assert.equal(order.totalAmountUSD, reference.amount);
    assert.equal(order.items.length, reference.lines.length);
    order.items.forEach((item, index) => {
      const line = reference.lines[index], color = item.colors[0];
      assert.equal(item.itemNo, line.style);
      assert.equal(item.vendorPart, line.vendor_part);
      assert.deepEqual(item.customerItemCodes, line.customer_item_codes);
      assert.equal(item.kitQty, line.pack_qty);
      assert.equal(item.piecesPerKit, line.pieces_per_pack);
      assert.equal(item.kitPriceUSD, line.pack_price);
      assert.equal(item.totalQuantity, line.qty);
      assert.equal(item.unitPriceUSD, line.unit_price);
      assert.equal(item.totalAmountUSD, line.amount);
      assert.deepEqual(item.sizes, line.size_order);
      assert.equal(color.colorCode, line.color);
      assert.equal(colorName(color.colorName), colorName(line.color_name));
      assert.deepEqual(color.quantitiesBySize, line.sizes);
      assert.deepEqual(color.ratioBySize, line.pack_sizes);
    });
  }
}

// Corruption must fail instead of importing plausible but incomplete quantities.
const reject = (label: string, change: (rows: string[][]) => void) => {
  const rows = fixture('029930'); change(rows);
  const result = parseGridToOrder(rows);
  assert.equal(result.success, false, `${label}: accepted corrupt composition`);
  assert.equal(result.order, undefined);
};
const component = (rows: string[][]) => rows.find(row => row[0] === 'S4156597' && row.length > 3)!;
const kit = (rows: string[][]) => rows.find(row => row[0] === 'S4157157')!;
reject('size quantity', rows => { component(rows)[component(rows).length - 1] = '38'; });
reject('ratio', rows => { component(rows)[component(rows).length - 2] = '2'; });
reject('duplicate size', rows => { rows.splice(rows.indexOf(component(rows)), 0, [...component(rows)], ['050']); });
reject('missing component', rows => { const i = rows.indexOf(component(rows)); rows.splice(i, 2); });
reject('component color', rows => { component(rows)[3] = '051'; });
reject('component product', rows => { component(rows)[2] = 'WRONG-'; });
reject('kit code', rows => { kit(rows)[0] = 'S9999999'; });
reject('kit pack count', rows => { kit(rows)[kit(rows).length - 3] = '38'; });
reject('kit pieces per pack', rows => { kit(rows)[kit(rows).length - 2] = '7'; });
reject('kit total', rows => { kit(rows)[kit(rows).length - 1] = '223'; });
reject('printed packs', rows => { rows.find(row => /^Total Pieces:/.test(row[0]))![0] = 'Total Pieces: 38'; });
reject('printed amount', rows => { const row = rows.find(row => row[0] === 'USD')!; row[row.length - 1] = '955.60'; });
reject('missing composition', rows => { rows.splice(rows.findIndex(row => row[0] === 'Kit composition')); });
console.log('PASS: four actual CSQ Multiple Pack PDFs match SK-KPI per kit, colour, size, price and total; 13 corrupt/missing-data cases rejected.');
