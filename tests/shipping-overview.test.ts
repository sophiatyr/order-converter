import assert from 'node:assert/strict';
import {shippingOverviewRows,shippingOverviewTotals} from '../src/utils/shippingOverview';
import {emptyWorkspace,type TrackingRecord,type Shipment} from '../src/utils/workspace';
import type {OrderData} from '../src/types/order';
const row=(po:string,style:string,quantity:number,unit='PCS')=>({id:po+style,poNumber:po,scNumber:'CS'+po,itemNo:style,quantity,unit,customerDate:'',factoryDate:'',status:'尚未出貨',source:'test',tp:'',labDip:'',fitSample:'',pps:'',fabricTestDate:'',fabricTestStatus:'',cutting:'',sewing:'',shippingSample:'',inspection:'',packing:'',remarks:'',company:'CISALFA',season:'SS27',brand:'ABC',supplier:'RJ',internalFields:{H:'1000',_scopeH:po},bulk:{}} as TrackingRecord);
const shipment=(id:string,po:string,quantity:number,price:number,confirmed=true,unit='PCS')=>({id,poNumber:po,scNumber:'CS'+po,customer:'TEST',address:'',invoiceNo:id,vessel:'',container:'',fromPort:'',toPort:'',remarks:'',confirmed,date:'2026-10-23',factoryNotice:{},lines:[{id:id+'L',itemNo:'A',description:'',color:'',netWeight:0,supplier:'RJ',unit,sizes:{S:quantity},unitPriceUSD:price,planned:100,cartons:1,grossWeight:1,cbm:1}]} as Shipment);
const w=emptyWorkspace();w.shipments=[shipment('a','1',20,10),shipment('b','1',30,10),shipment('draft','1',100,10,false),shipment('pairs','2',5,20,true,'PAIRS')];
const rows=[row('1','A',60),row('1','B',40),row('2','C',10,'雙'),row('3','D',50)];
const data=shippingOverviewRows(w,[],rows),one=data.find(r=>r.po==='1')!,two=data.find(r=>r.po==='2')!;
assert.equal(one.status,'partial');assert.deepEqual(one.quantities.PCS,{ordered:100,shipped:50,remaining:50});assert.equal(one.orderAmount,1000,'Repeated PO financial scope counted once');assert.equal(one.shippedAmount,500);assert.equal(one.remainingAmount,null,'Partial PO without source unit prices cannot infer balance from invoice amounts');assert.deepEqual(two.quantities.PAIRS,{ordered:10,shipped:5,remaining:5},'Different units are never combined');
const totals=shippingOverviewTotals(data);assert.equal(totals.draftBatches,1);assert.equal(totals.quantities.PCS.shipped,50,'Draft packed quantity is not actual');assert.equal(totals.quantities.PAIRS.shipped,5);
w.shipments[0].factoryNotice={batchDeletedAt:'deleted'};assert.equal(shippingOverviewRows(w,[],rows)[0].shippedAmount,500,'Soft-deleted confirmed history remains counted');
const historical=rows.map(r=>({...r,internalFields:{...r.internalFields,_shipmentClosed:'Y'}}));const closed=shippingOverviewRows(w,[],historical)[0];assert.equal(closed.status,'history');assert.equal(closed.quantities.PCS.shipped,50,'Legacy closure cannot create extra invoice quantity');assert.equal(closed.shippedAmount,500);assert.equal(closed.quantities.PCS.remaining,0);
w.shipments.push(shipment('missing','3',10,0));assert.equal(shippingOverviewRows(w,[],rows).find(r=>r.po==='3')!.shippedAmount,null,'Missing price cannot masquerade as zero shipment value');
w.shipments.push(shipment('over','1',90,10));const excess=shippingOverviewRows(w,[],rows)[0];assert.equal(excess.quantities.PCS.shipped,140);assert(excess.issues.length>0,'Over shipment is visible, not silently capped');
w.shipments.push(shipment('orphan','unknown',10,5));const unknown=shippingOverviewRows(w,[],rows).find(r=>r.po==='unknown')!;assert.equal(unknown.status,'unknown');assert.equal(unknown.orderAmount,null);assert.equal(unknown.remainingAmount,null);
const o={poNumber:'4',piNumber:'CS4',customerName:'TEST',totalAmountUSD:100,totalPieces:10,items:[{id:'i',itemNo:'X',unitPriceUSD:10,colors:[{id:'c',totalQuantity:10}],sizes:['S']}]} as OrderData;
assert.equal(shippingOverviewRows(emptyWorkspace(),[o],[])[0].quantities.PCS.ordered,10,'Newly imported PO appears even before tracking is refreshed');
assert.equal(shippingOverviewRows(w,[],rows).find(r=>r.po==='3')!.quantities.PCS.ordered,50,'Inputs never mutated');
console.log('PASS shipping overview: confirmed vs draft, partial shipments across batches/factories, scope totals, unit separation, legacy/soft-deleted history, missing prices, excess quantities, new orders and missing PO metadata.');

assert.equal(shippingOverviewRows(emptyWorkspace(),[],[row('PR','X',12,'PR')])[0].quantities.PAIRS.ordered,12,'PR reference units match PAIRS in actual shipments');

const changedPrice=emptyWorkspace();changedPrice.shipments=[shipment('repriced','1',100,9)];const completedPrice=shippingOverviewRows(changedPrice,[],[row('1','A',100)])[0];assert.equal(completedPrice.remainingAmount,0,'Fully shipped goods have no remaining shipment value');assert(completedPrice.issues.length>0,'Price variance stays visible');
