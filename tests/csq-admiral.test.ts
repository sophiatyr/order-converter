import assert from 'node:assert/strict';
import fs from 'node:fs';
import {layoutToRows,type PositionedText} from '../src/utils/documentLayout';
import {parseGridToOrder,parseTextToOrder} from '../src/utils/localPoParser';

// Original four-page PO; expected lines are independently parsed by SK-KPI.
const pages:PositionedText[][]=JSON.parse(fs.readFileSync('tests/fixtures/csq-admiral-47481-pages.json','utf8'));
const expected=JSON.parse(fs.readFileSync('tests/fixtures/csq-admiral-47481-expected.json','utf8'));
const rows=pages.flatMap(page=>[[],...layoutToRows(page)]);
for(const result of [parseGridToOrder(rows),parseTextToOrder(rows.map(row=>row.join('\t')).join('\n'))]){
 assert.equal(result.success,true,result.error);
 assert.deepEqual(result.warnings,[]);
 const order=result.order!;
 assert.equal(order.poNumber,'26OF047481');
 assert.equal(order.items.length,13);
 assert.equal(new Set(order.items.map(item=>item.itemNo)).size,11);
 assert.equal(order.totalPieces,27212);
 assert.equal(order.totalAmountUSD,100860.5);
 order.items.forEach((item,index)=>{
  const line=expected.lines[index];
  assert.equal(item.itemNo,line.style);assert.equal(item.vendorPart,line.vendor_part);
  assert.equal(item.colors[0].colorCode,line.color);assert.equal(item.colors[0].colorName,line.color_name);
  assert.equal(item.totalQuantity,line.qty);assert.equal(item.unitPriceUSD,line.unit_price);
  assert.deepEqual(item.sizes,line.size_order);
  assert.deepEqual(Object.fromEntries(Object.entries(item.colors[0].quantitiesBySize).filter(([,quantity])=>quantity)),line.sizes);
  assert.ok(!item.styleName.includes('Products composition'));assert.equal(item.compositionSource,'po');
 });
}
const incomplete=pages.slice(1).flatMap(page=>[[],...layoutToRows(page)]);
assert.equal(parseGridToOrder(incomplete).success,false,'Missing pages must not import a partial order');
const damaged=rows.map(row=>[...row]);const quantity=damaged.find(row=>row.includes('2250 PZ'))!;quantity[quantity.indexOf('2250 PZ')]='2251 PZ';assert.equal(parseGridToOrder(damaged).success,false);
console.log('PASS: ADMIRAL 26OF047481 matches SK-KPI: 13 colour lines / 11 styles / 27,212 pieces / USD 100,860.50, every size, AOP colour and unit price.');
