import {shippingInvoice,remainingPoAmount,seasonTags,revenueUnit,type ShippingInvoice} from './shippingRevenue';
import type {OrderData} from '../types/order';
import {shipmentQuantity,newShipment,type Workspace,type TrackingRecord,type Shipment} from './workspace';
import {orderFinancials} from './orderFinancials';
import {trackingFactoryCode} from './shipmentFactorySearch';
import {trackingQuantityUnit} from './trackingUnits';
import {containerBatchKey} from './containerShipments';

export interface ShippingOverviewRow {
 key:string;po:string;sc:string;customer:string;seasons:string[];brands:string[];factories:string[];
 quantities:Record<string,{ordered:number;shipped:number;remaining:number}>;orderedKnown:boolean;
 orderAmount:number|null;shippedAmount:number|null;remainingAmount:number|null;
 status:'pending'|'partial'|'completed'|'history'|'unknown';batches:Shipment[];invoices:ShippingInvoice[];history:boolean;issues:string[];
}
const unique=(a:(string|undefined)[])=>[...new Set(a.filter((x):x is string=>!!x))];
const key=(sc:string,po:string)=>JSON.stringify([sc,po]);
const quantityUnit=revenueUnit;
const money=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export function shippingOverviewRows(workspace:Workspace,orders:OrderData[],rows:TrackingRecord[]):ShippingOverviewRow[]{
 const groups=new Map<string,{order?:OrderData;rows:TrackingRecord[];shipments:Shipment[]}>();
 const get=(sc:string,po:string)=>{const k=key(sc,po);if(!groups.has(k))groups.set(k,{rows:[],shipments:[]});return groups.get(k)!;};
 for(const o of orders)if(!workspace.removedOrders?.[o.poNumber])get(o.piNumber,o.poNumber).order=o;
 for(const r of rows.filter(r=>r.color===undefined))get(r.scNumber,r.poNumber).rows.push(r);
 // A deleted confirmed batch is still an actual historical shipment.
 for(const s of workspace.shipments)if(s.confirmed||!s.factoryNotice?.batchDeletedAt)get(s.scNumber,s.poNumber).shipments.push(s);
 const financials=new Map(orderFinancials(rows.filter(r=>r.color===undefined)).map(g=>[g.key,g.salesAmount]));
 return [...groups].map(([k,g])=>{
  const o=g.order,r=g.rows[0],s=g.shipments[0],po=o?.poNumber||r?.poNumber||s!.poNumber,sc=o?.piNumber||r?.scNumber||s!.scNumber;
  const quantities:ShippingOverviewRow['quantities']={},q=(unit:string)=>quantities[quantityUnit(unit)]??(quantities[quantityUnit(unit)]={ordered:0,shipped:0,remaining:0});
  if(o&&o.items.some(i=>i.colors.length))for(const l of newShipment(o,'overview').lines){const units=unique(g.rows.filter(r=>r.itemNo===l.itemNo||r.itemNo.replace(/-(XS|S|M|L|XL|XXL|XXXL)$/,'')===l.itemNo).map(r=>quantityUnit(r.unit)));q(units.length===1?units[0]:l.unit).ordered+=l.planned;}
  else for(const r of g.rows)q(r.unit).ordered+=r.quantity;
  const confirmed=g.shipments.filter(s=>s.confirmed),orderedKnown=!!o||g.rows.length>0;
  const invoices=confirmed.map(s=>shippingInvoice(s,o,g.rows)).filter((i):i is ShippingInvoice=>!!i);
  const fulfilled:Record<string,number>={};for(const s of confirmed)for(const l of s.lines){const unit=quantityUnit(l.unit);fulfilled[unit]=(fulfilled[unit]||0)+shipmentQuantity(l);q(unit);}
  for(const i of invoices)for(const [unit,amount] of Object.entries(i.quantities))q(unit).shipped+=amount;
  const closed=g.rows.filter(r=>r.internalFields?._shipmentClosed==='Y'),history=closed.length>0,allClosed=g.rows.length>0&&closed.length===g.rows.length;
  if(allClosed)for(const [unit,v] of Object.entries(quantities))fulfilled[unit]=Math.max(fulfilled[unit]||0,v.ordered);
  const issues:string[]=[];
  if(confirmed.some(s=>!s.invoiceNo.trim()&&s.lines.some(l=>shipmentQuantity(l)>0)))issues.push('已確認出貨缺 Invoice 號碼，未列入業績');
  for(const [unit,v] of Object.entries(quantities)){v.remaining=Math.max(0,v.ordered-(fulfilled[unit]||0));if(orderedKnown&&(fulfilled[unit]||0)>v.ordered)issues.push(`${unit} 已出數量超出訂單`);}
  if(o&&!allClosed&&o.items.some(i=>i.colors.length)&&o.items.every(i=>i.colors.every(c=>!!c.quantitiesBySize&&Object.values(c.quantitiesBySize).reduce((n,q)=>n+q,0)===c.totalQuantity))){
   for(const v of Object.values(quantities))v.remaining=0;
   for(const l of newShipment(o,'remaining').lines){const units=unique(g.rows.filter(r=>r.itemNo===l.itemNo||r.itemNo.replace(/-(XS|S|M|L|XL|XXL|XXXL)$/,'')===l.itemNo).map(r=>quantityUnit(r.unit))),unit=units.length===1?units[0]:l.unit,plan=o.items.flatMap(i=>i.colors.map(c=>({id:i.id+':'+c.id,sizes:c.quantitiesBySize}))).find(p=>p.id===l.id);if(!plan)continue;const actual=confirmed.flatMap(s=>s.lines).filter(x=>x.id===l.id||x.itemNo===l.itemNo&&x.color===l.color);q(unit).remaining+=Object.entries(plan.sizes).reduce((n,[size,count])=>n+Math.max(0,count-actual.reduce((n,x)=>n+(x.sizes[size]||0),0)),0);}
  }
  const orderAmount=o&&Number.isFinite(o.totalAmountUSD)?money(o.totalAmountUSD):financials.get(k)??null;
  const shippedAmount=invoices.length?invoices.some(i=>i.sales===null)?null:money(invoices.reduce((n,i)=>n+i.sales!,0)):history?null:0;
  const shipped=Object.values(fulfilled).some(q=>q>0),remaining=Object.values(quantities).some(q=>q.remaining>0),missingInvoice=Object.entries(quantities).some(([unit,q])=>(fulfilled[unit]||0)>q.shipped);
  const status:ShippingOverviewRow['status']=!orderedKnown?'unknown':!remaining&&shipped?missingInvoice?'history':'completed':shipped?'partial':'pending';
  const remainingAmount=status==='completed'||status==='history'?0:remainingPoAmount(o,g.rows,confirmed,allClosed,orderAmount);
  if(status==='completed'&&orderAmount!==null&&invoices.every(i=>i.gross!==null)&&Math.abs(invoices.reduce((n,i)=>n+i.gross!,0)-orderAmount)>.02)issues.push('實際 Invoice 貨款與 PO 金額有差異');
  if(remaining&&remainingAmount===null)issues.push('缺完整 PO 單價或款色配對，待出金額待核對');
  return {key:k,po,sc,customer:o?.orderingCompany||o?.customerName||r?.company||s?.customer||'',seasons:seasonTags(o?.season?[o.season]:g.rows.map(r=>r.season)),brands:unique([o?.brand,...g.rows.map(r=>r.brand)]),factories:unique(g.rows.map(r=>trackingFactoryCode(r,o?[o]:[])).concat(o?.supplierCode||[],o?.items.flatMap(i=>i.factoryProduct?.supplierCode||i.factoryPriceRecord?.party||[])||[])),quantities,orderedKnown,orderAmount,shippedAmount,remainingAmount,status,batches:g.shipments,invoices,history,issues};
 }).sort((a,b)=>a.po.localeCompare(b.po,'en',{numeric:true})||a.sc.localeCompare(b.sc));
}
export function shippingOverviewTotals(rows:ShippingOverviewRow[]){
 const quantities:Record<string,{ordered:number;shipped:number;remaining:number}>={};
 for(const r of rows)for(const [unit,q] of Object.entries(r.quantities)){const total=quantities[unit]??(quantities[unit]={ordered:0,shipped:0,remaining:0});for(const f of ['ordered','shipped','remaining'] as const)total[f]+=q[f];}
 const amounts=(field:'orderAmount'|'shippedAmount'|'remainingAmount')=>({value:money(rows.reduce((n,r)=>n+(r[field]??0),0)),missing:rows.filter(r=>r[field]===null&&(field!=='shippedAmount'||r.invoices.length>0)).length});
 return {orderCount:rows.length,shippedOrderCount:rows.filter(r=>r.invoices.length>0).length,pendingOrderCount:rows.filter(r=>Object.values(r.quantities).some(q=>q.remaining>0)).length,invoiceCount:new Set(rows.flatMap(r=>r.invoices.map(i=>JSON.stringify([i.customer,i.invoice])))).size,historyCount:rows.filter(r=>r.status==='history').length,quantities,ordered:amounts('orderAmount'),shipped:amounts('shippedAmount'),remaining:amounts('remainingAmount'),draftBatches:new Set(rows.flatMap(r=>r.batches.filter(s=>!s.confirmed&&!s.factoryNotice?.batchDeletedAt).map(containerBatchKey))).size};
}



