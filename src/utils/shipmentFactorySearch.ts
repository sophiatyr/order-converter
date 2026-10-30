import type {OrderData} from '../types/order';
import type {TrackingRecord} from './workspace';
const codes=(values:(string|undefined)[])=>[...new Set(values.flatMap(v=>(v||'').toUpperCase().split(/\s*[/,、]\s*/)).map(v=>v.trim()).filter(v=>/^[A-Z0-9][A-Z0-9_-]{0,15}$/.test(v)))];
export function trackingFactoryCode(r:TrackingRecord,orders:OrderData[]=[]){
 const o=orders.find(o=>o.poNumber===r.poNumber&&o.piNumber===r.scNumber),base=r.itemNo.replace(/-(XS|S|M|L|XL|XXL|XXXL)$/,'');
 const items=o?.items.filter(i=>i.itemNo===r.itemNo||i.itemNo===base)||[],assigned=codes(items.map(i=>i.factoryProduct?.supplierCode||i.factoryPriceRecord?.party));
 const rowCode=codes([r.supplierCode]).join(' / ')||codes([r.internalFields?.J]).join(' / ')||codes([r.supplier]).join(' / ');
 return assigned.length?assigned.join(' / '):rowCode||codes([o?.supplierCode]).join(' / ');
}
export function shipmentTrackingMatches(r:TrackingRecord,query:string,orders:OrderData[]=[]){const fields=[r.poNumber,r.scNumber,r.itemNo,r.series,r.supplier,r.supplierName,trackingFactoryCode(r,orders)].join(' ').toUpperCase();return query.trim().toUpperCase().split(/\s+/).every(t=>fields.includes(t));}
export function shipmentOrderMatches(o:OrderData,query:string,rows:TrackingRecord[]=[]){const fields=[o.poNumber,o.piNumber,o.customerName,o.orderingCompany,o.factorySupplier,o.supplierCode,...o.items.flatMap(i=>[i.factoryProduct?.supplierCode,i.factoryProduct?.supplier,i.factoryPriceRecord?.party]),...rows.filter(r=>r.poNumber===o.poNumber&&r.scNumber===o.piNumber).map(r=>trackingFactoryCode(r,[o]))].join(' ').toUpperCase();return query.trim().toUpperCase().split(/\s+/).every(t=>fields.includes(t));}
