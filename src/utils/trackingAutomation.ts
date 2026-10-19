import type {TrackingRecord,Workspace} from './workspace';
import {poStyleItems,shipmentStyleQuantity} from './trackingPoSource';

export function localToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function activeTrackingRows(rows:TrackingRecord[]){
 const orders=new Map<string,TrackingRecord[]>(),key=(r:TrackingRecord)=>JSON.stringify([r.scNumber,r.poNumber]);
 for(const r of rows)orders.set(key(r),[...(orders.get(key(r))||[]),r]);
 const complete=new Set([...orders].filter(([,items])=>items.every(r=>r.internalFields?._shipmentClosed==='Y'||r.quantity>0&&r.status==='已出貨'&&(r.shippedQuantity||0)>=r.quantity)).map(([id])=>id));
 return rows.filter(r=>!complete.has(key(r)));
}
export function daysToFactory(value:string,today=localToday()){
 const parse=(s:string)=>{const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);const iso=m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:s;return /^\d{4}-\d{2}-\d{2}$/.test(iso)&&!Number.isNaN(Date.parse(iso))&&new Date(iso).toISOString().slice(0,10)===iso?Date.parse(iso):NaN;};
 const n=(parse(value)-parse(today))/86400000;return Number.isFinite(n)?Math.round(n):null;
}
export function syncTracking(r:TrackingRecord,w:Workspace):TrackingRecord{
 const fields={...r.internalFields},bulk={...r.bulk};const order=w.orders.find(o=>o.poNumber===r.poNumber&&o.piNumber===r.scNumber);
 if(!order&&fields._profitFormula&&Number(fields.H)>0&&fields.L!==''){
  const cost=fields._costCurrency==='USD'?Number(fields.L):Number(fields._rmbPerUsd)>0?Number(fields.L)/Number(fields._rmbPerUsd):null;
  if(cost!==null&&Number.isFinite(cost)){fields.M=String(cost);fields.N=String((Number(fields.H)-cost)/Number(fields.H));fields._saleForMargin=fields.H;}
 }
 if(order){Object.assign(fields,{A:order.piNumber,B:order.poNumber,O:r.itemNo,P:String(r.quantity),T:order.shipmentDate,U:order.factoryShipDate,R:order.poDate,S:order.piDate,I:order.packingType||'NORMAL PACK',H:String(order.totalAmountUSD),_scopeH:`order:${order.poNumber}`});
  if(order.season)fields.C=order.season;
  const current=poStyleItems(order,r.itemNo),item=current[0];if(item?.factoryProduct){fields.J=item.factoryProduct.supplierCode;fields.K=item.factoryProduct.supplier;}
  const quote=item?.factoryProduct;
  if(quote&&current.every(i=>i.factoryProduct?.supplier===quote.supplier&&i.factoryProduct?.currency===quote.currency)){
   const group=order.items.filter(i=>i.factoryProduct?.supplier===quote.supplier&&i.factoryProduct.currency===quote.currency);
   const cost=group.reduce((n,i)=>n+i.totalQuantity*i.factoryProduct!.price,0),sale=group.reduce((n,i)=>n+i.totalQuantity*i.unitPriceUSD,0),scope=`erp:${order.poNumber}:${quote.supplier}:${quote.currency}`;
   const usd=quote.currency==='USD'?cost:order.rmbPerUsd&&order.rmbPerUsd>0?cost/order.rmbPerUsd:null;
   Object.assign(fields,{L:String(cost),_costCurrency:quote.currency,_scopeL:scope,_scopeM:scope,_scopeN:scope,_saleForMargin:String(sale),_profitAmount:usd===null?'':String(sale-usd),M:usd===null?'':String(usd),N:usd!==null&&sale>0?String((sale-usd)/sale):''});
  }
 }
 const days=daysToFactory(r.factoryDate||fields.U||'');fields.V=days===null?'':String(days);
 if(!Object.hasOwn(bulk,'ppsStatus')&&fields.AD&&daysToFactory(fields.AD)!==null){bulk.ppsStatus='APPROVED';bulk.ppsApprovalDate=fields.AD;bulk.ppsDate=bulk.ppsDate||fields.AC||'';}
 const shipments=w.shipments.filter(s=>s.confirmed&&s.poNumber===r.poNumber&&s.scNumber===r.scNumber&&s.lines.some(l=>shipmentStyleQuantity(l,r.itemNo,order)>0)).sort((a,b)=>a.date.localeCompare(b.date));
 const lines=shipments.flatMap(s=>s.lines.filter(l=>shipmentStyleQuantity(l,r.itemNo,order)>0));const qty=lines.reduce((n,l)=>n+shipmentStyleQuantity(l,r.itemNo,order),0);
 if(qty>0){const s=shipments.at(-1)!;bulk.shipmentStatus=qty>=r.quantity?'SHIPPED':'PLANNED';bulk.shipmentDate=qty>=r.quantity?s.date:bulk.shipmentPlannedDate||'';fields.AK=s.date;fields.AO=[...new Set(shipments.map(s=>s.vessel).filter(Boolean))].join(' / ');fields.AP=String(lines.reduce((n,l)=>n+l.cbm,0));fields.AQ=shipments.map(s=>s.invoiceNo).join(' / ');}
 else if(r.season==='SS27'||order){bulk.shipmentStatus='PLANNED';bulk.shipmentDate=bulk.shipmentPlannedDate||'';}
 if(fields._shipmentClosed==='Y')bulk.shipmentStatus='SHIPPED';
 // An automatic link is recalculated each time; reverting a shipment to draft removes it.
 return {...r,season:order?.season||r.season,internalFields:fields,bulk,status:fields._shipmentClosed==='Y'?'已出貨':qty>0?(qty>=r.quantity?'已出貨':'部分出貨'):r.status==='已出貨'||r.status==='部分出貨'?'尚未出貨':r.status,shippedQuantity:qty};
}
export function trackingTargets(rows:TrackingRecord[],scope:'style'|'order'|'filter',query:string,selected:string[]=[]){
 if(scope!=='filter'&&!query.trim()&&!selected.length)return [];
 const terms=query.toUpperCase().split(/[,，;；\n]/).map(s=>s.trim()).filter(Boolean);
 const match=(r:TrackingRecord)=>!terms.length||terms.some(t=>(scope==='style'?r.itemNo:[r.poNumber,r.scNumber].join(' ')).toUpperCase().includes(t));
 const eligible=rows.filter(match);if(!selected.length)return eligible;
 const picked=eligible.filter(r=>selected.includes(r.id));
 if(scope==='filter')return picked;
 return eligible.filter(r=>picked.some(p=>scope==='style'?p.itemNo===r.itemNo&&p.season===r.season&&p.company===r.company:p.poNumber===r.poNumber&&p.scNumber===r.scNumber));
}
const stageColumns:Record<string,string>={tp:'W',labDip:'AA',fitSample:'AB',shippingSample:'AF',inspection:'AH'};
export function applyTrackingStage(w:Workspace,rows:TrackingRecord[],phase:string,date:string,status:string){
 const tracking={...w.tracking};
 for(const r of rows){const old=tracking[r.id]||{},bulk={...r.bulk,...old.bulk,[phase+'Date']:date,[phase+'Status']:status},internalFields={...old.internalFields};
  delete bulk.shipmentDate;delete bulk.shipmentStatus;
  if(stageColumns[phase]&&date)internalFields[stageColumns[phase]]=date;
  if(phase==='pps'){if(status==='APPROVED'){internalFields.AD=date;bulk.ppsApprovalDate=date;bulk.ppsDate=old.bulk?.ppsDate||r.bulk?.ppsDate||r.internalFields?.AC||'';}else if(date)internalFields.AC=date;}
  const legacy:Record<string,string>={};if(phase==='pps'&&status==='APPROVED')legacy.pps=date;
  tracking[r.id]={...old,...legacy,bulk,internalFields};
  for(const id of Object.keys(tracking).filter(id=>id.startsWith(r.id+':colour:'))){const child=tracking[id];tracking[id]={...child,bulk:{...child.bulk,[phase+'Date']:date,[phase+'Status']:status}};}
 }
 return {...w,tracking};
}
