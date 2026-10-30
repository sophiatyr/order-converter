import type {OrderData} from '../types/order';
import {shipmentQuantity,type Shipment,type TrackingRecord} from './workspace';
import {shippingInvoiceCargoAmounts} from './shippingWorkflow';
import {overviewDate} from './orderOverview';
export const revenueMoney=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export const revenueUnit=(unit:string)=>/^(雙|双|PR|PAIR|PAIRS)$/i.test(unit.trim())?'PAIRS':/^(套|SET|SETS)$/i.test(unit.trim())?'SETS':/^(件|PC|PCS|PCE|PO\s*單位)?$/i.test(unit.trim())?'PCS':unit;
export const seasonTags=(values:(string|undefined)[])=>[...new Set(values.flatMap(v=>(v||'').split(/\s*\/\s*/)).map(s=>s.trim().toUpperCase()).filter(Boolean))];
export function customerSeasonYear(season:string){const m=season.match(/^(?:SS|AW|FW)(\d{2}|\d{4})$/i);return m?(m[1].length===2?'20':'')+m[1]:'';}
export interface ShippingInvoice {id:string;key:string;invoice:string;po:string;sc:string;customer:string;exportDate:string;seasons:string[];quantities:Record<string,number>;gross:number|null;discount:number|null;sales:number|null;shipment:Shipment}
export function shippingInvoice(s:Shipment,o:OrderData|undefined,rows:TrackingRecord[]):ShippingInvoice|null{
 if(!s.confirmed||!s.invoiceNo.trim()||!s.lines.some(l=>shipmentQuantity(l)>0))return null;
 const quantities:Record<string,number>={};for(const l of s.lines){const unit=revenueUnit(l.unit);quantities[unit]=(quantities[unit]||0)+shipmentQuantity(l);}
 const metadata=s.factoryNotice||{},number=(key:string)=>metadata[key]!==undefined&&metadata[key]!==''&&Number.isFinite(Number(metadata[key]))&&Number(metadata[key])>=0?Number(metadata[key]):null;
 const valid=s.lines.every(l=>!shipmentQuantity(l)||Number.isFinite(l.unitPriceUSD)&&l.unitPriceUSD>0),computed=valid?shippingInvoiceCargoAmounts(s,metadata.confirmedInvoiceCustomer||o?.orderingCompany||o?.customerName||s.customer||rows[0]?.company||''):null;
 const gross=number('confirmedInvoiceGross')??computed?.gross??null,discount=number('confirmedInvoiceDiscount')??computed?.discount??null,sales=number('confirmedInvoiceSales')??(gross!==null&&discount!==null&&discount<=gross?revenueMoney(gross-discount):null);
 return {id:s.id,key:JSON.stringify([s.scNumber,s.poNumber]),invoice:s.invoiceNo,po:s.poNumber,sc:s.scNumber,customer:metadata.confirmedInvoiceCustomer||o?.orderingCompany||s.customer||rows[0]?.company||'',exportDate:overviewDate(s.date),seasons:seasonTags(metadata.confirmedInvoiceSeason?[metadata.confirmedInvoiceSeason]:o?.season?[o.season]:rows.map(r=>r.season)),quantities,gross,discount,sales,shipment:s};
}
/** Price the unshipped colours using customer PO prices, never invoice prices or a PO average. */
export function remainingPoAmount(o:OrderData|undefined,rows:TrackingRecord[],confirmed:Shipment[],fullyClosed:boolean,fullAmount:number|null):number|null{
 if(fullyClosed)return 0;
 const actual=confirmed.flatMap(s=>s.lines).filter(l=>shipmentQuantity(l)>0);
 if(!actual.length)return fullAmount;
 if(!o)return null;
 const plans=o.items.flatMap(i=>i.colors.map(c=>({id:i.id+':'+c.id,style:i.itemNo,color:(c.colorCode+' '+c.colorName).trim().toUpperCase(),code:(c.colorCode||'').trim().toUpperCase(),quantity:c.totalQuantity,price:i.unitPriceUSD,shipped:0,sizes:c.quantitiesBySize||{},shippedSizes:{} as Record<string,number>})));
 const normalized=(s:string)=>s.trim().replace(/\s+/g,' ').toUpperCase();
 for(const l of actual){
  const variant=l.itemNo.match(/^(.+)-(XS|S|M|L|XL|XXL|XXXL)$/),base=variant&&o.items.some(i=>i.itemNo===variant[1]&&i.sizes.includes(variant[2]))?variant[1]:l.itemNo;
  let matches=plans.filter(p=>p.id===l.id);if(!matches.length)matches=plans.filter(p=>p.style===base&&(normalized(l.color)===normalized(p.color)||p.code&&normalized(l.color).startsWith(p.code+' ')));
  if(!matches.length&&plans.filter(p=>p.style===base).length===1)matches=plans.filter(p=>p.style===base);
  if(matches.length!==1)return null;matches[0].shipped+=shipmentQuantity(l);for(const [size,q]of Object.entries(l.sizes))matches[0].shippedSizes[size]=(matches[0].shippedSizes[size]||0)+q;
 }
 if(rows.some(r=>r.internalFields?._shipmentClosed==='Y'))return null;
 const remaining=(p:typeof plans[number])=>Object.values(p.sizes).reduce((n,q)=>n+q,0)===p.quantity?Object.entries(p.sizes).reduce((n,[size,q])=>n+Math.max(0,q-(p.shippedSizes[size]||0)),0):Math.max(0,p.quantity-p.shipped);
 if(plans.some(p=>remaining(p)>0&&(!Number.isFinite(p.price)||p.price<=0)))return null;
 const full=revenueMoney(plans.reduce((n,p)=>n+p.quantity*p.price,0));
 if(fullAmount!==null&&Math.abs(full-fullAmount)>.02)return null;
 return revenueMoney(plans.reduce((n,p)=>n+remaining(p)*p.price,0));
}
export function summarizeInvoices(invoices:ShippingInvoice[]){
 const quantities:Record<string,number>={};for(const i of invoices)for(const [unit,q] of Object.entries(i.quantities))quantities[unit]=(quantities[unit]||0)+q;
 return {orders:new Set(invoices.map(i=>i.key)).size,invoices:new Set(invoices.map(i=>JSON.stringify([i.customer,i.invoice]))).size,quantities,sales:revenueMoney(invoices.reduce((n,i)=>n+(i.sales??0),0)),missing:invoices.filter(i=>i.sales===null).length};
}
export function exportPeriodInvoices(invoices:ShippingInvoice[],year:string,month=''){return invoices.filter(i=>i.exportDate.startsWith(year+'-')&&(!month||i.exportDate.slice(5,7)===month));}


