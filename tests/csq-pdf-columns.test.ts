import assert from 'node:assert/strict';
import {layoutToRows, type PositionedText} from '../src/utils/documentLayout';
import {parseGridToOrder, parseTextToOrder} from '../src/utils/localPoParser';

// Coordinates and quantities checked against the two-page ABC CSQ PDFs.
// Keep the right-aligned numeric positions that previously merged 80 and 190.
const at = (text: string, x: number, width: number, y = 10): PositionedText => ({text,x,width,y,height:8});
const quantities = {
  '315': [[140,350,420,200,90],[100,270,310,150,70],[120,300,350,160,70],[100,240,365,175,120],[80,200,280,140,100],[80,200,280,140,100]],
  '337': [[80,190,210,110,60],[50,100,130,70,50],[50,150,170,80,50],[60,170,200,110,60],[50,100,130,70,50],[50,100,130,70,50]],
};
for(const [po, lines] of Object.entries(quantities)) {
  const rows: string[][] = [['Order number',`26OF000${po}`],['Vendor part number','Description']];
  lines.forEach((values, index) => {
    if(index===4) rows.push([],['Vendor account','Vendor invoice'],['CI MAG SNATT SPORTSCHECK']);
    const sizes = index<3 ? ['S','M','L','XL','XXL'] : ['XS','S','M','L','XL'];
    const style=index<3?'ABCRM1039W26':'ABCRW1036W26';
    const color=['050','237','627','050','1136','437'][index];
    const total=values.reduce((a,b)=>a+b,0), price=index<3?2.1:2;
    rows.push([`${style}-${color}`,'T-SHIRT']);
    const sizeXs=[192.2,222.8,259.1,287.9,316.6];
    const sizeWidths=[3.9,6.7,3.6,8.2,12.7];
    const rightEdges=[195.1,228.5,261.7,295.1,328.3];
    const tokens=[...sizes.map((s,i)=>at(s,sizeXs[i],sizeWidths[i])),at(color,77.7,12.1,30),at('BLACK',117.7,20.2,30),
      ...values.map((q,i)=>at(String(q),rightEdges[i]-String(q).length*3.76,String(q).length*3.76,30)),
      at(String(total),632.2-String(total).length*3.76,String(total).length*3.76,30),at('PZ',636.3,9,31),
      at(price.toFixed(2),684.1,12.8,30),at((total*price).toFixed(2),765.9,25.7,30)];
    const recovered=layoutToRows(tokens);
    assert.deepEqual(recovered[1].slice(2,7),values.map(String));
    rows.push(...recovered);
  });
  const total=po==='315'?5700:2950, amount=po==='315'?11710:6055;
  rows.push([`Total Pieces: ${total}`],['USD',amount.toFixed(2)]);
  for(const result of [parseGridToOrder(rows),parseTextToOrder(rows.map(r=>r.join('\t')).join('\n'))]) {
    assert.equal(result.success,true,result.error);
    assert.equal(result.order?.items.length,6);
    assert.equal(result.order?.totalPieces,total);
    assert.equal(result.order?.totalAmountUSD,amount);
    assert.deepEqual(result.warnings,[]);
    result.order!.items.forEach((item,index)=>{
      const color=item.colors[0];
      assert.deepEqual(Object.values(color.quantitiesBySize),lines[index]);
      assert.equal(color.colorName,'BLACK');
      assert.equal(Object.values(color.quantitiesBySize).reduce((a,b)=>a+b,0),color.totalQuantity);
    });
  }
}
const ambiguous=parseTextToOrder('Vendor part number\tDescription\nABCRM1039W26-050\tT-shirt\nS\tM\n050\tBLACK\t80 190\t210\t480 PZ\t2.10\t1008.00');
assert.equal(ambiguous.order?.totalPieces,480);
assert.ok(ambiguous.warnings?.some(w=>w.includes('尺碼')));
assert.equal(ambiguous.order?.items[0].colors[0].quantitiesBySize.S,0);
console.log('PASS: CSQ PDF right-aligned size quantities, both six-colour PO totals, page boundaries and ambiguous number rejection.');
import fs from 'node:fs';
const tennisPages:string[][][]=JSON.parse(fs.readFileSync('tests/fixtures/csq-tennis-1636-rows.json','utf8'));
const tennisRows=[['Page','1 of 5'],['Order number','26OF001636','Delivery terms','FOB'],['Date','26/01/2026','Ship date on board','23/07/2026'],['Terms of payment','90LC'],['Vendor part number','Description'],...tennisPages.flatMap((page,n)=>n?[[],['Vendor account','Vendor invoice'],['Page',`${n+1} of 5`],...page]:page)];
// All 19 source lines, checked against the five-page PDF, not just grand totals.
const expectedTennis=[
 ['ABCTM030CO','001','S4133127',1000,2.35,[180,328,316,176,0,0,0]],
 ['ABCTM080CO','001','S4133130',2000,3.25,[360,656,632,352,0,0,0]],
 ['ABCTM080CO','050','S4133131',3000,3.25,[540,984,948,528,0,0,0]],
 ['ABCTJ030CO','001','S4133133',1000,2.1,[0,56,116,246,306,276,0]],
 ['ABCTJ080CO','001','S4133135',1000,3,[0,56,116,246,306,276,0]],
 ['ABCTW030CO','050','S4140451',1000,2.35,[180,328,316,176]],
 ['ABCTW080CO','050','S4140453',500,4.2,[83,167,167,83,0,0,0]],
 ['ABCTM030W26','254','S4153038',2000,2.35,[360,656,632,352]],
 ['ABCTM032W26','050/001','S4153039',3000,2.65,[540,984,948,528]],
 ['ABCTM035W26','703','S4153040',1000,3.25,[180,328,316,176]],
 ['ABCTM082W26','050/001','S4153043',1000,3.75,[180,328,316,176]],
 ['ABCTW032W26','001','S4153044',1000,2.6,[180,328,316,176]],
 ['ABCTW035W26','387','S4153045',400,3,[72,128,128,72]],
 ['ABCTW010W26','050','S4153047',200,7,[36,64,64,36]],
 ['ABCTW070CO','001','S4153048',500,4.2,[83,167,167,83]],
 ['ABCTW070W26','402','S4153049',500,4.2,[90,164,158,88]],
 ['ABCTJ032W26','564/001','S4153050',1000,2.45,[56,116,246,306,276]],
 ['ABCTJ080W26','050','S4153051',1000,3,[56,116,246,306,276]],
 ['ABCTM010W26','050','S4153997',500,7.35,[90,164,158,88]],
] as const;
for(const result of [parseGridToOrder(tennisRows),parseTextToOrder(tennisRows.map(r=>r.join('\t')).join('\n'))]){
 assert.equal(result.success,true,result.error);assert.deepEqual(result.warnings,[]);const order=result.order!;
 assert.equal(order.items.length,19);assert.equal(order.totalPieces,21600);assert.equal(order.totalAmountUSD,66325);assert.equal(order.sourcePrintedQuantity,21600);assert.equal(order.sourcePrintedAmount,66325);assert.equal(order.shipmentDate,'23/07/2026');
 expectedTennis.forEach(([sku,color,customerCode,qty,price,sizes],n)=>{const i=order.items[n];assert.equal(i.itemNo,sku);assert.equal(i.colors[0].colorCode,color);assert.deepEqual(i.customerItemCodes,[customerCode]);assert.equal(i.totalQuantity,qty);assert.equal(i.unitPriceUSD,price);assert.deepEqual(Object.values(i.colors[0].quantitiesBySize),sizes);assert.equal(i.totalAmountUSD,qty*price);});
 assert.equal(order.items[3].sizes[0],'4A');assert.equal(order.items[16].colors[0].colorName,'18-3949 TPG Dazzling Blue+WHITE');assert.equal(order.items[7].colors[0].colorName,'18-1561 TPG Orange.com');
}
console.log('PASS: five-page 26OF001636, all 19 styles/colors/customer codes/prices/size quantities; 21,600 pieces and USD 66,325.');
