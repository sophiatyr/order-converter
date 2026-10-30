import assert from 'node:assert/strict';
import {shipmentLcs,withShipmentLcs,lcForLine,setOrderLc,inheritOrderLc} from '../src/utils/shipmentLc';
import {trackingFactoryCode,shipmentTrackingMatches,shipmentOrderMatches} from '../src/utils/shipmentFactorySearch';
import {emptyWorkspace,type Shipment,type TrackingRecord} from '../src/utils/workspace';
import type {OrderData} from '../src/types/order';
const s={id:'a',poNumber:'PO1',scNumber:'SC1',confirmed:false,lines:[{id:'red',itemNo:'STYLE1',color:'RED',sizes:{}},{id:'blue',itemNo:'STYLE2',color:'BLUE',sizes:{}}],factoryNotice:{}} as Shipment;
const one=withShipmentLcs(s,[{number:' LC1 ',date:'2026-10-23',bank:'BANK NAME ',lineIds:[]}]);assert.deepEqual(shipmentLcs(one)[0].lineIds,['red','blue']);assert.equal(lcForLine({...one,lines:[...one.lines,{...one.lines[0],id:'new'}]},'new'),'LC1','One LC covers newly added styles without manual selection');assert.equal(one.factoryNotice?.lcIssueDate,'2026-10-23');assert.equal(shipmentLcs(one)[0].bank,'BANK NAME ','Typing multi-word bank names preserves spaces');
const legacy={...s,factoryNotice:{lcEntries:JSON.stringify([{number:'LC1',date:'',bank:'',lineIds:['red']},{number:'LC1',date:'2026-10-23',bank:'BANK',lineIds:['blue']},{number:'',date:'',bank:'',lineIds:[]}])}};assert.equal(shipmentLcs(legacy).length,1);assert.equal(lcForLine(legacy,'blue'),'LC1');assert.equal(shipmentLcs(legacy)[0].date,'2026-10-23');
const multi={...s,factoryNotice:{lcEntries:JSON.stringify([{number:'LC1',date:'',bank:'',lineIds:['red']},{number:'LC2',date:'',bank:'',lineIds:['blue']}])}};
assert.throws(()=>withShipmentLcs(s,shipmentLcs(multi)),/只能對應一個/);
assert.throws(()=>lcForLine(multi,'red'),/只能對應一個/);
assert.equal(lcForLine({...multi,confirmed:true},'red'),'LC1','Previously confirmed history remains readable');
const rows=[{id:'r1',poNumber:'PO1',scNumber:'SC1',itemNo:'STYLE1',supplier:'雅麗莎公司',supplierCode:'YLS',internalFields:{},bulk:{}},{id:'r2',poNumber:'PO1',scNumber:'SC1',itemNo:'STYLE2',supplier:'泉州工廠',supplierCode:'RJ',internalFields:{},bulk:{}},{id:'other',poNumber:'PO1',scNumber:'OTHER',itemNo:'STYLE1',supplier:'RJ',bulk:{}}] as TrackingRecord[];
const otherBatch={...s,id:'b'},history={...one,id:'history',confirmed:true},workspace={...emptyWorkspace(),shipments:[s,otherBatch,history]};const changed=setOrderLc(workspace,rows,'PO1','SC1','NEW',{date:'2026-10-23',bank:'BANK'});assert.equal(changed.shipments[0].factoryNotice?.lcNumber,'NEW');assert.equal(changed.shipments[1].factoryNotice?.lcNumber,'NEW');assert.equal(changed.shipments[2],history);assert.equal(changed.tracking.r1.bulk?.shipmentLc,'NEW');assert.equal(changed.tracking.r2.bulk?.shipmentLc,'NEW');assert.equal(changed.tracking.other,undefined);assert.equal(s.factoryNotice?.lcNumber,undefined);assert.throws(()=>setOrderLc({...workspace,shipments:[multi]},rows,'PO1','SC1','REPLACE'));
assert.equal(inheritOrderLc(s,rows.map(r=>({...r,bulk:{shipmentLc:'TRACKED'}})),[history]).factoryNotice?.lcNumber,'TRACKED');
const order={poNumber:'PO1',piNumber:'SC1',supplierCode:'YLS',factorySupplier:'雅麗莎公司',customerName:'CISALFA',items:[{itemNo:'STYLE1',factoryProduct:{supplierCode:'YLS',supplier:'雅麗莎公司'}},{itemNo:'STYLE2',factoryProduct:{supplierCode:'RJ',supplier:'泉州工廠'}}]} as OrderData;
assert.equal(trackingFactoryCode({...rows[0],bulk:{shipmentRemark:'OLD FREE TEXT'}},[order]),'YLS');assert.equal(trackingFactoryCode(rows[1],[order]),'RJ');assert(shipmentTrackingMatches(rows[0],' yls ',[order]));assert(!shipmentTrackingMatches(rows[0],' xhx ',[order]));assert(shipmentOrderMatches(order,'RJ'));assert(shipmentOrderMatches(order,'YLS PO1'));assert(shipmentOrderMatches({...order,supplierCode:'',items:[]},'YLS',rows));
console.log('PASS simplified LC and factory search: one PO one LC, automatic style coverage, duplicate/empty cleanup, bank typing, multi-LC exceptions, pending batch + tracking sync, confirmed history retained, code-only remarks and factory-code searches.');

assert.equal(inheritOrderLc(s,rows.map(r=>({...r,bulk:{shipmentLc:''}})),[history]).factoryNotice?.lcNumber,undefined,'Explicitly cleared LC must not return from historical shipments');

assert.equal(trackingFactoryCode(rows[0],[{...order,supplierCode:'OLD',items:[]}]),'YLS','A tracking style code must not be mixed with an old order-level code');


// One LC covers multiple POs, with one atomic assignment and common bank/date.
const {setLcOrderGroup,containerLcOrders}=await import('../src/utils/shipmentLc');
const po2={...s,id:'po2',poNumber:'PO2',scNumber:'SC2'},po3={...s,id:'po3',poNumber:'PO3',scNumber:'SC3'};
const groupRows=[...rows,{...rows[0],id:'r3',poNumber:'PO2',scNumber:'SC2'},{...rows[0],id:'r4',poNumber:'PO3',scNumber:'SC3'}];
const gw={...workspace,shipments:[s,otherBatch,history,po2,po3]};
const assigned=setLcOrderGroup(gw,groupRows,[{po:'PO1',sc:'SC1'},{po:'PO2',sc:'SC2'}],{number:'SHARED-LC',date:'2026-10-28',bank:'COMMON BANK'});
assert.equal(assigned.shipments.filter(s=>s.factoryNotice?.lcNumber==='SHARED-LC').length,3);
assert.equal(assigned.tracking.r3.bulk?.shipmentLc,'SHARED-LC');assert.equal(assigned.tracking.r1.bulk?.shipmentLc,'SHARED-LC');assert.equal(assigned.shipments[2],history);assert.deepEqual(gw.shipments[0],s,'No mutation before save');
assert.equal(containerLcOrders([assigned.shipments[0],assigned.shipments[3]],groupRows).filter(o=>o.numbers[0]==='SHARED-LC').length,2);
const reassigned=setLcOrderGroup(assigned,groupRows,[{po:'PO2',sc:'SC2'}],{number:'NEW-LC',date:'',bank:''});
assert.deepEqual(shipmentLcs(reassigned.shipments[3]).map(e=>e.number),['NEW-LC']);assert.equal(reassigned.shipments[0].factoryNotice?.lcNumber,'SHARED-LC');
const edited=setLcOrderGroup(assigned,groupRows,[{po:'PO1',sc:'SC1'}],{number:'RENAMED',date:'',bank:''},{number:'SHARED-LC',orders:[{po:'PO1',sc:'SC1'},{po:'PO2',sc:'SC2'}]});
assert.equal(edited.tracking.r3.bulk?.shipmentLc,'');assert.equal(shipmentLcs(edited.shipments[3]).length,0);
const metaUpdated=setLcOrderGroup(assigned,groupRows,[{po:'PO1',sc:'SC1'}],{number:'SHARED-LC',date:'2026-10-29',bank:'UPDATED BANK'});
assert.equal(metaUpdated.shipments[3].factoryNotice?.lcIssueDate,'2026-10-29','Common LC metadata reaches other pending POs outside selected list');
assert.equal(metaUpdated.shipments[3].factoryNotice?.lcIssueBank,'UPDATED BANK');
assert.throws(()=>setLcOrderGroup(gw,groupRows,[],{number:'LC',date:'',bank:''}));
assert.throws(()=>setLcOrderGroup(gw,groupRows,[{po:'PO1',sc:'SC1'}],{number:'LC',date:'2026-02-30',bank:''}));
assert.throws(()=>setOrderLc(gw,groupRows,'PO1','SC1','LC1 / LC2'));
const normalized=setLcOrderGroup({...gw,shipments:[multi,po2]},groupRows,[{po:'PO1',sc:'SC1'}],{number:'ONE',date:'',bank:''});assert.equal(shipmentLcs(normalized.shipments[0]).length,1,'Explicit group save reconciles legacy multiple LC draft data');
console.log('PASS grouped LC: multiple POs, atomic assignments, shared metadata, reassignment/removal, legacy resolution and immutable confirmed history.');
