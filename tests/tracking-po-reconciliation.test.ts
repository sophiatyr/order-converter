import assert from 'node:assert/strict';import fs from 'node:fs';
import {layoutToRows,type LayoutContext} from '../src/utils/documentLayout';
import {parseGridToOrder} from '../src/utils/localPoParser';import {normalizeCsqOrder} from '../src/utils/csqAccount';
import {emptyWorkspace,trackingRows,newShipment,type ReferenceSnapshot} from '../src/utils/workspace';
import {completeCustomerRows} from '../src/utils/trackingDocuments';
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/tracking-po-reconciliation.json','utf8'));
// Quantities independently checked on original customer PDFs, including continued size rows.
const totals:Record<string,number>={'26OF028473':12940,'26OF029332':12054,'26OF029925':444,'26OF031991':12390,'26OF031992':7914,'26OF031993':11028,'26OF033275':12600,'26OF033387':9100,'26OF036538':3105,'26OF036555':1710,'26OF042264':9900,'26OF044203':29400,'26OF044377':31650,'26OF044379':28350};
const orders=fixture.originals.map(({po,pages}:any)=>{const context:LayoutContext={};const result=parseGridToOrder(pages.flatMap((page:any)=>[[],...layoutToRows(page,context)]));assert.equal(result.success,true,result.error);const o=normalizeCsqOrder({...result.order!,season:'SS27'});assert.equal(o.totalPieces,totals[po]);for(const i of o.items)for(const c of i.colors)assert.equal(Object.values(c.quantitiesBySize).reduce((n:number,q:number)=>n+q,0),c.totalQuantity,`${po} ${i.itemNo} ${c.colorCode} sizes must sum to colour quantity`);return o;});
const refs={version:1,updatedAt:'',orders:[],tracking:fixture.tracking,files:[],schemas:[],warnings:[]} as ReferenceSnapshot;
const first=refs.tracking[0];const w={...emptyWorkspace(),orders,tracking:{[first.id]:{bulk:{ppsStatus:'APPROVED',ppsDate:'2026-08-10'},remarks:'Keep production notes'}}};
const rows=trackingRows(w,refs),pending=completeCustomerRows(rows,orders).filter(r=>r.sourceIssue);assert.equal(pending.length,0);
for(const [po,total]of Object.entries(totals))assert.equal(rows.filter(r=>r.poNumber===po).reduce((n,r)=>n+r.quantity,0),total,`${po}: tracker must match original PO without duplicates`);
const qty=(po:string,sku:string)=>rows.find(r=>r.poNumber===po&&r.itemNo===sku)?.quantity;
assert.equal(qty('26OF028473','ABCTW070CO'),500);assert.equal(qty('26OF029925','ABCRB1039S27'),222);assert.equal(qty('26OF029925','ABCRG1036S27'),222);assert.equal(qty('26OF029332','ABCRM1056S27'),6666);
assert.equal(qty('26OF033275','ABKJ200'),1600);assert.equal(qty('26OF033387','ABKJ200'),1600);
for(const [po,expected]of Object.entries({'26OF031991':[426,1290,5190,5484],'26OF031992':[1062,1422,3258,2172],'26OF031993':[1806,2430,3960,2832]})){assert.equal(rows.filter(r=>r.poNumber===po).length,4);assert.deepEqual(['S','M','L','XL'].map(s=>qty(po,`RCL006-${s}`)),expected);assert.ok(!rows.some(r=>r.poNumber===po&&r.itemNo==='RCL006'));}
assert.equal(rows.find(r=>r.poNumber===first.poNumber&&r.itemNo===first.itemNo)?.bulk?.ppsStatus,'APPROVED');assert.equal(rows.find(r=>r.poNumber===first.poNumber&&r.itemNo===first.itemNo)?.remarks,'Keep production notes');
// Corrections are PO-specific: identical style text on another order must remain untouched.
const other=trackingRows(emptyWorkspace(),{...refs,tracking:[{...first,id:'unrelated',poNumber:'26OF999999',itemNo:'ABCTW070S27'}]});assert.equal(other[0].itemNo,'ABCTW070S27');
const socks=orders.find((o:any)=>o.poNumber==='26OF031991')!,shipment=newShipment(socks,'size-shipment');shipment.confirmed=true;shipment.date='2026-10-19';shipment.lines=[{...shipment.lines.find(l=>l.color.startsWith('050/010 '))!,sizes:{S:200,M:100,L:0,XL:0}}];
const shippedRows=trackingRows({...w,shipments:[shipment]},refs).filter(r=>r.poNumber===socks.poNumber);assert.deepEqual(['S','M','L','XL'].map(s=>shippedRows.find(r=>r.itemNo===`RCL006-${s}`)?.shippedQuantity),[200,100,0,0]);
const shippedColors=completeCustomerRows(shippedRows,orders,{},[shipment]);assert.equal(shippedColors.find(r=>r.itemNo==='RCL006-S'&&r.color?.startsWith('050/010 '))?.shippedQuantity,200);assert.equal(shippedColors.find(r=>r.itemNo==='RCL006-M'&&r.color?.startsWith('050/010 '))?.shippedQuantity,100);
console.log('PASS: 14 original customer POs, 38 pending styles resolved, three sock size matrices, page continuation, exact style aliases, no duplicate quantities and preserved production updates.');
