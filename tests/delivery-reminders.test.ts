import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deliveryReminders} from '../src/utils/deliveryReminders';
import type {TrackingRecord} from '../src/utils/workspace';
const base:TrackingRecord=JSON.parse(fs.readFileSync('public/csq-workspace-references.json','utf8')).tracking[0];
const today='2026-10-15';
const row=(id:string,date:string,extra:Partial<TrackingRecord>={}):TrackingRecord=>({...base,id,poNumber:'PO1',scNumber:'SC1',supplier:'XHX',supplierCode:'XHX',factoryDate:date,quantity:100,shippedQuantity:0,status:'尚未出貨',unit:'件',bulk:{},internalFields:{},...extra});
for(const [date,days,level] of [['2026-11-15',31,'later'],['2026-11-14',30,'yellow'],['2026-10-26',11,'yellow'],['2026-10-25',10,'red'],['2026-10-15',0,'red'],['2026-10-14',-1,'red'],['',null,'unknown'],['31/02/2026',null,'unknown']] as const){
 const result=deliveryReminders([row('1',date)],today)[0];assert.equal(result.days,days);assert.equal(result.level,level);
}
assert.equal(deliveryReminders([row('1','14/11/2026')],today)[0].days,30);
const grouped=deliveryReminders([row('a','2026-10-25',{shippedQuantity:40,status:'部分出貨'}),row('b','25/10/2026'),row('c','2026-10-25',{supplier:'YLS',supplierCode:'YLS'}),row('d','2026-10-26'),row('e','2026-10-25',{shippedQuantity:100,status:'已出貨'}),row('f','2026-10-25',{poNumber:'PO2'}),row('g','2026-10-25',{unit:'雙'})],today);
assert.equal(grouped.length,5);const xhx=grouped.find(g=>g.poNumber==='PO1'&&g.supplier==='XHX'&&g.days===10&&g.units==='件')!;
assert.equal(xhx.remaining,160);assert.equal(xhx.rows.length,2);assert.ok(!grouped.flatMap(g=>g.rows).some(r=>r.id==='e'));
assert.ok(!xhx.booked);
const booked=deliveryReminders(xhx.rows.map(r=>({...r,bulk:{bookingStatus:'BOOKED'}})),today)[0];assert.ok(booked.booked);assert.equal(booked.level,'red','Booking must not hide a shipping reminder');assert.equal(booked.remaining,160);
assert.equal(deliveryReminders([row('empty','2026-10-25',{quantity:0})],today).length,0);
assert.equal(deliveryReminders([row('shipped','2026-10-25',{shippedQuantity:100})],today).length,0);
assert.deepEqual(deliveryReminders([row('later','2026-10-20'),row('past','2026-10-01'),row('missing','')],today).map(g=>g.days),[-14,5,null]);
console.log('PASS: 30/10-day boundaries, overdue/missing dates, partial/full shipments, independent PO/factory/deadline/unit grouping, earliest-first sorting and booking visibility.');
