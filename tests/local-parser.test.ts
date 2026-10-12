import assert from 'node:assert/strict';
import { parseTextToOrder, parseGridToOrder } from '../src/utils/localPoParser.ts';
import { layoutToRows } from '../src/utils/documentLayout.ts';
import { csqOrderNumber, csqFactoryDate, normalizeCsqOrder, factoryDocument } from '../src/utils/csqAccount.ts';
import { readCsqBackup } from '../src/utils/csqBackup.ts';
const raw = `Order number\t26OF000003\tDelivery terms\tFOB
Date\t09/01/2026\tShip date on board\t29/06/2026
Terms of payment\t90LC\tBrand\tARENA-PL
Item\tUnit\tDiscount
Vendor part number\tDescription\tCode\tDelivery\tQty Unit\tprice\tAmount
ATW095W26-840\tSEAMLESS BRA ARENA W - KNIT: 92% POLIAMMIDE
8%ELASTANE\tS4151972
XS\tS\tM\tL\tXL
Multiplo\t1\t1\t1\t1\t1
840\t19-0515 TPG OLIVE\t30\t90\t120\t15\t255 PZ\t4.60\t1,173.00
NIGHT
Total Pieces: 255`;
const result = parseTextToOrder(raw);
assert.equal(result.success,true,result.error);
assert.equal(result.order?.poNumber,'26OF000003');
assert.equal(result.order?.items[0].itemNo,'ATW095W26');
assert.equal(result.order?.totalPieces,255);
assert.equal(result.order?.totalAmountUSD,1173);
assert.equal(result.order?.items[0].kitQty,undefined);
assert.equal(result.order?.packingType,'NORMAL PACK');
assert.deepEqual(result.order?.items[0].orderMultipleBySize,{XS:1,S:1,M:1,L:1,XL:1});
assert.equal(result.order?.factoryShipDate,'2026-05-29');
assert.deepEqual(result.order?.items[0].customerItemCodes,['S4151972']);
assert.equal(result.order?.items[0].colors[0].colorName,'19-0515 TPG OLIVE NIGHT');
assert.ok(result.warnings?.some(w=>w.includes('尺碼')));
const aligned = parseTextToOrder(raw.replace('OLIVE\t30','OLIVE\t\t30'));
assert.equal(aligned.order?.items[0].colors[0].quantitiesBySize.S,30);
assert.equal(aligned.order?.items[0].colors[0].quantitiesBySize.XS,0);
const positionedRows = layoutToRows([
  ...['XS','S','M','L','XL'].map((text,index)=>({text,x:200+index*50,y:10,width:15,height:10})),
  ...[['840',10],['OLIVE',60],['30',250],['90',300],['120',350],['15',400],['255 PZ',480],['4.60',550]].map(([text,x])=>({text:String(text),x:Number(x),y:30,width:25,height:10})),
]);
assert.deepEqual(positionedRows[1],['840','OLIVE','','30','90','120','15','255 PZ','4.60']);
const basic = parseTextToOrder('PO No: PO888801\nItem\tQty\tPrice\nTEST001\t60\t2.50');
assert.equal(basic.order?.totalAmountUSD,150);
const missing = parseTextToOrder('Item\tQty\tPrice\nUNKNOWN\t\t');
assert.equal(missing.order?.totalPieces,0);
assert.equal(missing.order?.totalAmountUSD,0);
assert.equal(parseTextToOrder('Company name\nJust some text').success,false);
const quoted = parseTextToOrder('Item,Qty,Price\nTEST001,"1,200","2,50"');
assert.equal(quoted.order?.totalAmountUSD,3000);
const repeat = parseGridToOrder([['Item','Qty','Price'],['TEST001',60,2.5],['Item','Qty','Price'],['TEST002',60,3.5]]);
assert.equal(repeat.order?.items.length,2);
assert.equal(csqOrderNumber('26OF032891','CISALFA'),'CS26032891');
assert.equal(csqOrderNumber('26OF032891','PREMIUM SPORTS'),'CS032891PS');
assert.equal(csqOrderNumber('1234','FALIS','2024-07-28'),'CS241234FA');
assert.equal(csqOrderNumber('PO0012345','ITALIAN FITNESS'),'CS012345IF');
assert.equal(csqOrderNumber('PO0012345','INTERSPORT'),'CS012345IT');
assert.equal(csqOrderNumber('24OF012345','MEDICO'),'CS012345ME');
assert.equal(csqOrderNumber('MFEL-24-123','MEDICO'),'');
assert.equal(csqFactoryDate('2026-03-31'),'2026-02-28');
assert.equal(csqFactoryDate('2024-03-31'),'2024-02-29');
assert.equal(csqFactoryDate('2026-01-31'),'2025-12-31');
assert.equal(csqFactoryDate('2026-02-31'),'');
assert.equal(parseTextToOrder(raw+'\nKit composition').success,false);
const differentSizes = parseTextToOrder(raw.replace('Total Pieces: 255', 'OTHER01-050\tSecond item\nS\tM\nMultiplo\t1\t1\n050\tBLACK\t2\t3\t5 PZ\t2.00\t10.00\nTotal Pieces: 260'));
assert.equal(differentSizes.order?.totalPieces,260);
assert.deepEqual(differentSizes.order?.items[1].sizes,['S','M']);
assert.deepEqual(differentSizes.order?.items[1].colors[0].quantitiesBySize,{S:2,M:3});
const dual = parseTextToOrder(raw.replace('ATW095W26-840','ATW095W26-').replace('8%ELASTANE\tS4151972','001/050\tS4151972').replace('840\t19-0515','001/050\t19-0515'));
assert.equal(dual.order?.items[0].vendorPart,'ATW095W26-001/050');
assert.equal(dual.order?.items[0].colors[0].colorCode,'001/050');
const priced = normalizeCsqOrder({...aligned.order!,items: aligned.order!.items.map(item=>({...item,factoryUnitPriceUSD:2}))});
assert.equal(priced.totalAmountUSD,1173);
assert.equal(factoryDocument(priced).items[0].unitPriceUSD,2);
assert.equal(priced.items[0].unitPriceUSD,4.6);
const restored = readCsqBackup(JSON.stringify({version:1,account:'CSQ',order:priced}));
assert.equal(restored.totalAmountUSD,1173);
assert.equal(restored.items[0].factoryUnitPriceUSD,2);
const skPreview = readCsqBackup(JSON.stringify({template_code:'CSQ',header:{customer_po:'26OF000003',currency:'USD',customer_name:'CISALFA SPORT SPA.',order_date:'2026-01-09',ship_date:'2026-06-29',pack_type:'single'},lines:[{style:'ATW095W26',color:'840',color_name:'OLIVE',size_order:['XS','S'],sizes:{S:255},qty:255,unit_price:4.6,customer_item_codes:['S4151972']}],summary:{quantity:255,amount:1173}}));
assert.equal(skPreview.totalPieces,255);
assert.deepEqual(skPreview.items[0].colors[0].quantitiesBySize,{XS:0,S:255});
assert.throws(()=>readCsqBackup('{}'));
console.log('PASS: CSQ company numbering, calendar-month factory date, normal Multiplo, wrapped style/dual colors, mixed size grids, totals, blank columns, isolated factory cost, TSV/CSV.');
