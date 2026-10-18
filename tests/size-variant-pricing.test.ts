import assert from 'node:assert/strict';
import fs from 'node:fs';
import ExcelJS from 'exceljs';
import {normalizeCsqOrder} from '../src/utils/csqAccount';
import {applyErpProducts,erpFactoryOrders} from '../src/utils/erpProducts';
import {assignStyleFactories} from '../src/utils/factoryAssignments';
import {buildReferenceDocument} from '../src/utils/referenceDocuments';
import {pricingCode} from '../src/utils/sizeVariants';
const data=JSON.parse(fs.readFileSync('public/csq-document-templates.json','utf8'));
const refs=JSON.parse(fs.readFileSync('public/csq-reference-products.json','utf8')).records;
const source=JSON.parse(fs.readFileSync('public/csq-workspace-references.json','utf8')).orders.find((o:any)=>o.piNumber==='CS26031991');
const erp=JSON.parse(fs.readFileSync('public/erp-products.json','utf8'));
const normalized=normalizeCsqOrder(source),applied=applyErpProducts(normalized,erp);
assert.equal(applied.matched,source.items.length);assert.equal(applied.issues.length,0);
assert.deepEqual(normalized.items.map(i=>i.id),source.items.map((i:any)=>i.id));
assert.deepEqual(normalizeCsqOrder(applied.order),applied.order,'Normalizing a mapped order must preserve selected costs');
const expected=[['S',426,.95,.81],['M',1290,.98,.84],['L',5190,1,.86],['XL',5484,1.05,.9]];
for(const [size,quantity,sale,cost] of expected){const items=applied.order.items.filter(i=>pricingCode(i)===`RCL006-${size}`);assert.equal(items.reduce((n,i)=>n+i.totalQuantity,0),quantity);assert.ok(items.every(i=>i.unitPriceUSD===sale&&i.factoryProduct?.price===cost&&i.factoryProduct.unit==='雙'));}
const factoryOrder=erpFactoryOrders(applied.order)[0].order;assert.equal(factoryOrder.totalPieces,12390);assert.equal(Math.round(factoryOrder.totalAmountUSD*100)/100,10827.66);assert.equal(Math.round(applied.order.totalAmountUSD*100)/100,12617.1);
const modified=assignStyleFactories(applied.order,{'RCL006-S':{supplierCode:'HET',supplier:'海鹽華爾特針織有限公司',currency:'USD',price:'.82',date:'2026-07-22',unit:'雙'}});assert.ok(modified.items.filter(i=>pricingCode(i)!=='RCL006-S').every(i=>i.factoryProduct?.price===applied.order.items.find(p=>p.id===i.id)!.factoryProduct?.price));
for(const kind of ['pi','factory','quantity','overview'] as const){
 const book=buildReferenceDocument(data,kind,kind==='factory'?factoryOrder:applied.order,refs,erp).book;
 const ws=book.worksheets[0],rows:any[][]=[];ws.eachRow(row=>rows.push(Array.from({length:ws.columnCount},(_,i)=>(row.getCell(i+1).value as any)?.richText?row.getCell(i+1).text:row.getCell(i+1).value)));
 if(kind==='pi'){
  assert.equal(rows.filter(r=>r[1]==='RCL006').length,1);
  const lines=rows.filter(r=>typeof r[3]==='string'&&/^SIZE: \d/.test(r[3]));assert.equal(lines.length,4);
  assert.deepEqual(lines.map(r=>r.slice(-3,-1)),expected.map(([,q,p])=>[q,p]));
  assert.equal(rows.filter(r=>r[0]==='519/010').length,1);
 }
 if(kind==='factory'){
  const lines=rows.filter(r=>typeof r[1]==='string'&&/^RCL006-/.test(r[1]));assert.deepEqual(lines.map(r=>[r[1],r[6],r[7]]),expected.map(([size,q,,p])=>[`RCL006-${size}`,q,p]));
  assert.ok(lines.every(r=>r[8]?.formula));
 }
 if(kind==='overview'){
  const lines=rows.filter(r=>typeof r[1]==='string'&&/^RCL006-/.test(r[1]));
  assert.deepEqual(lines.map(r=>[r[1],r[3],r[6]]),expected.map(([size,q,p])=>[`RCL006-${size}`,q,p]));
  assert.equal(rows.filter(r=>r[1]==='RCL006').length,0);
 }
 if(kind==='quantity'){
  assert.equal(book.worksheets.length,1);assert.equal(ws.name,'RCL006');assert.ok(rows.some(r=>r[0]==='尺寸'&&r.includes('19.5X46CM')));assert.ok(rows.some(r=>String(r[0]).startsWith('120雙')));assert.ok(rows.some(r=>String(r[1]).includes('WHITE\n白')));
  const colors=rows.filter(r=>['519/010','050/010','010'].includes(r[0]));assert.deepEqual(colors.map(r=>r.slice(2)),[[0,936,726,984,2646],[426,354,3336,3060,7176],[0,0,1128,1440,2568]]);
 }
 const restored=new ExcelJS.Workbook();await restored.xlsx.load(await book.xlsx.writeBuffer());assert.equal(restored.worksheets.length,book.worksheets.length);
}
console.log('PASS: CS26031991 size SKU mapping, individual sales and factory prices, isolated edits, grouped P/I and quantity matrix, Excel roundtrip.');
