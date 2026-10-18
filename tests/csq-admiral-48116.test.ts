import assert from 'node:assert/strict';
import fs from 'node:fs';
import {layoutToRows,type PositionedText} from '../src/utils/documentLayout';
import {parseGridToOrder,parseTextToOrder} from '../src/utils/localPoParser';
// Original 2-page 26OF048116 PDF, visually checked against both rendered pages.
const pages:PositionedText[][]=JSON.parse(fs.readFileSync('tests/fixtures/csq-admiral-48116-pages.json','utf8'));
const rows=pages.flatMap(page=>[[],...layoutToRows(page)]);
const expected=[
 ['ADM613S27','AOP2','LEAVES GREEN','S4159880',4.95,[0,140,260,270,200,130,0]],
 ['ADM615S27','AOP','MULTICOLOR LEAVES','S4159882',5.15,[0,140,260,270,200,130,0]],
 ['ADM616S27','AOP','BANDANA BLUE','S4159883',5.1,[0,140,260,270,200,130,0]],
 ['ADM617S27','AOP','PALM','S4159884',5.9,[0,140,260,270,200,130,0]],
 ['ADM620S27','AOP','BLUE DEGRADE','S4159885',5.1,[0,200,290,230,150,130,0]],
] as const;
for(const result of [parseGridToOrder(rows,'26OF048116 ADMIRAL BEACHWEAR_SPORTS KITE.pdf'),parseTextToOrder(rows.map(r=>r.join('\t')).join('\n'))]){
 assert.equal(result.success,true,result.error);assert.deepEqual(result.warnings,[]);const order=result.order!;
 assert.equal(order.poNumber,'26OF048116');assert.equal(order.items.length,5);assert.equal(order.totalPieces,5000);assert.equal(order.totalAmountUSD,26200);assert.equal(order.shipmentDate,'12/04/2027');assert.equal(order.packingType,'NORMAL PACK');
 order.items.forEach((item,n)=>{const [style,color,name,customer,price,quantities]=expected[n];assert.equal(item.itemNo,style);assert.equal(item.vendorPart,`${style}-${color}`);assert.equal(item.colors[0].colorCode,color);assert.equal(item.colors[0].colorName,name);assert.deepEqual(item.customerItemCodes,[customer]);assert.equal(item.totalQuantity,1000);assert.equal(item.unitPriceUSD,price);assert.deepEqual(item.sizes,['XS','S','M','L','XL','XXL','XXXL']);assert.deepEqual(item.sizes.map(s=>item.colors[0].quantitiesBySize[s]),quantities);assert.equal(item.isPrepack,false);});
}
const canonical=rows.map(r=>r.map(c=>c.replace(/AOP 2/g,'AOP2')));assert.equal(parseGridToOrder(canonical).success,true);
const damaged=rows.map(r=>[...r]);const first=damaged.find(r=>r[0]==='AOP 2')!;first[first.indexOf('140')]='141';assert.equal(parseGridToOrder(damaged).success,false,'A real size total mismatch must still be rejected');
assert.equal(parseGridToOrder(pages.slice(0,1).flatMap(p=>[[],...layoutToRows(p)])).success,false,'Missing page must still be rejected');
console.log('PASS: original ADMIRAL 26OF048116 spaced AOP 2 and compact AOP2; all five styles, seven size columns with blank XS/XXXL, colours, prices, 5000 pieces and USD26200; corrupt/missing data still blocked.');
