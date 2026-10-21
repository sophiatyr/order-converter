import {lcForLine} from './shipmentLc';
import {trackingQuantityUnit} from './trackingUnits';
import {shipmentSelectionIssues} from './shipmentSelection';
import type {ClassificationOption} from './classificationOptions';
import {pricingCode,sizeVariantOrder} from './sizeVariants';
import {verifiedTrackingStyle} from './verifiedTrackingStyles';
import type { OrderData } from '../types/order';
import {readCsqBackup} from './csqBackup';
import {syncTracking} from './trackingAutomation';
import {normalizeClassification,cleanSeries,canonicalSeries,canonicalSeason,canonicalBrand} from './classification';
import type {ErpSnapshot} from './erpProducts';
import {normalizeTrackingFactories} from './factoryDirectory';
import {packingIssues,type CartonRow} from './shipmentPacking';
import type {ProductMappingItem} from '../types/database';
export const WORKSPACE_KEY='CSQ_WORKSPACE_V1';
export const modules=[['orders','訂單作業'],['tracking','訂單追蹤'],['shipping','出貨作業'],['development','開發管理'],['products','產品資料'],['data','數據管理']] as const;
export type ModuleId=typeof modules[number][0];
export interface TrackingRecord {
 importedAt?:string;
 shippedQuantity?:number;series?:string;sourceIssue?:string;supplierCode?:string;supplierName?:string;
 internalFields?:Record<string,string>;bulk?:Record<string,string>;color?:string;description?:string;customerItem?:string;
 id:string;scNumber:string;poNumber:string;itemNo:string;quantity:number;unit:string;season:string;brand:string;company:string;supplier:string;customerDate:string;factoryDate:string;status:string;source:string;
 tp:string;labDip:string;fitSample:string;pps:string;fabricTestDate:string;fabricTestStatus:string;cutting:string;sewing:string;shippingSample:string;inspection:string;packing:string;remarks:string;
}
export interface ReferenceSnapshot {completedShipmentOrders?:string[];version:number;updatedAt:string;orders?:OrderData[];poImportIssues?:{file:string;reason:string;po?:string}[];bulkProgressAudit?:{matched:number;issues:{po:string;style:string;reason:string;orderQuantity?:number;sourceQuantity?:number}[]};files:{path:string;name:string;module:string}[];tracking:TrackingRecord[];schemas:{module:string;name:string;fields:string[]}[];warnings:{file:string;reason:string}[]}
export interface Development {id:string;itemNo:string;name:string;brand:string;series?:string;season:string;supplier:string;sampleStatus:string;targetDate:string;sentDate:string;price:number;currency:string;remarks:string}
export interface ShipmentLine {id:string;itemNo:string;description:string;color:string;unit:string;planned:number;sizes:Record<string,number>;unitPriceUSD:number;supplier:string;cartons:number;netWeight:number;grossWeight:number;cbm:number;packingRows?:CartonRow[]}
export interface Shipment {id:string;poNumber:string;scNumber:string;customer:string;address:string;invoiceNo:string;date:string;vessel:string;container:string;fromPort:string;toPort:string;remarks:string;confirmed:boolean;lines:ShipmentLine[];factoryNotice?:Record<string,string>}
export interface ProductPrice {id:string;kind:'customer'|'factory';party:string;partyName?:string;date:string;currency:string;price:number;unit:string;remarks:string;createdAt:string;source?:string;document?:string}
export interface ProductNote {colorTranslations?:Record<string,string>;chineseName?:string;chineseSpec?:string;brand:string;series?:string;season:string;remarks:string;name?:string;spec?:string;createdFromPo?:string;customerPrice?:number;customerCurrency?:string;supplierCode?:string;factoryPrice?:number;factoryCurrency?:string;photo?:string;archived?:boolean;prices?:ProductPrice[];withdrawnPrices?:Record<string,string>}
export interface Workspace {removedOrders?:Record<string,OrderData>;version:1;orders:OrderData[];tracking:Record<string,Partial<TrackingRecord>>;developments:Development[];shipments:Shipment[];productNotes:Record<string,ProductNote>;productMappings?:ProductMappingItem[];classificationOptions?:Record<string,ClassificationOption>}
export function emptyWorkspace():Workspace{return {version:1,orders:[],tracking:{},developments:[],shipments:[],productNotes:{}};}
export function normalizeWorkspace(w:Workspace):Workspace{
 return {...w,...(w.classificationOptions?{classificationOptions:Object.fromEntries(Object.entries(w.classificationOptions).map(([id,o])=>[id,{...o,value:o.kind==='series'?canonicalSeries(o.value):o.kind==='brand'?canonicalBrand(o.value):o.kind==='season'?canonicalSeason(o.value):o.value.trim().toUpperCase()}]))}:{}),orders:w.orders.map(normalizeClassification),developments:w.developments.map(normalizeClassification),productNotes:Object.fromEntries(Object.entries(w.productNotes).map(([key,value])=>[key,normalizeClassification(value)])),tracking:Object.fromEntries(Object.entries(w.tracking).map(([key,value])=>[key,{...normalizeClassification(value),...(value.internalFields?{internalFields:{...value.internalFields,...(value.internalFields.D!==undefined?{D:canonicalBrand(value.internalFields.D)}:{}),...(value.internalFields.E!==undefined?{E:cleanSeries(value.internalFields.E)}:{})}}:{})}]))};
}
export function upsertOrder(w:Workspace,order:OrderData):Workspace{const prior=w.orders.find(o=>o.poNumber===order.poNumber);order={...order,importedAt:prior?prior.importedAt||order.importedAt:order.importedAt||new Date().toISOString()};const removedOrders=w.removedOrders?{...w.removedOrders}:undefined;if(removedOrders)delete removedOrders[order.poNumber];return normalizeWorkspace({...w,...(removedOrders?{removedOrders}:{}),orders:[order,...w.orders.filter(o=>o.poNumber!==order.poNumber)]});}
export function loadWorkspace(raw:string|null,current:OrderData|null):Workspace {
 let w=emptyWorkspace();
 if(raw){
  const p:Workspace=JSON.parse(raw);
  if(p.version!==1||!Array.isArray(p.orders)||!Array.isArray(p.shipments)||!Array.isArray(p.developments)||!p.tracking||Array.isArray(p.tracking)||!p.productNotes||Array.isArray(p.productNotes))throw new Error('工作站備份格式不符');
  if(p.classificationOptions!==undefined&&(!p.classificationOptions||typeof p.classificationOptions!=='object'||Array.isArray(p.classificationOptions)||Object.entries(p.classificationOptions).some(([id,o])=>!id||['__proto__','constructor','prototype'].includes(id)||!o||!['brand','season','series','factory'].includes(o.kind)||typeof o.value!=='string'||!o.value.trim()||o.value.length>120||/[\u0000-\u001f]/.test(o.value))))throw new Error('分類選項格式不符');
  if(p.removedOrders!==undefined){if(!p.removedOrders||typeof p.removedOrders!=='object'||Array.isArray(p.removedOrders))throw new Error('已移除訂單格式不符');p.removedOrders=Object.fromEntries(Object.entries(p.removedOrders).map(([po,o])=>{if(!po||['__proto__','constructor','prototype'].includes(po)||o?.poNumber!==po)throw new Error('已移除訂單編號不符');return [po,readCsqBackup(JSON.stringify({version:1,account:'CSQ',order:o}))];}));}
  p.orders=[...new Map(p.orders.map(o=>{const order=readCsqBackup(JSON.stringify({version:1,account:'CSQ',order:o}));return [order.poNumber,order] as const;})).values()];
  if(p.productMappings!==undefined&&(!Array.isArray(p.productMappings)||p.productMappings.some(v=>!v||typeof v.id!=='string'||typeof v.itemNo!=='string'||['styleNameEN','chineseName','chineseSpec'].some(k=>typeof v[k as keyof ProductMappingItem]!=='string')||[v.customerPriceUSD,v.factoryPrice].some(n=>n!==undefined&&(!Number.isFinite(n)||n<0)))))throw new Error('產品對照資料格式不符');
  if(p.shipments.some(s=>['id','poNumber','scNumber','invoiceNo','date','customer','address','vessel','container','fromPort','toPort','remarks'].some(key=>typeof s[key as keyof Shipment]!=='string')||typeof s.confirmed!=='boolean'||!Array.isArray(s.lines)||s.lines.some(l=>['id','itemNo','description','color','unit','supplier'].some(key=>typeof l[key as keyof ShipmentLine]!=='string')||[l.planned,l.unitPriceUSD,l.cartons,l.netWeight,l.grossWeight,l.cbm].some(n=>!Number.isFinite(n)||n<0)||!l.sizes||Object.values(l.sizes).some(q=>typeof q!=='number'||!Number.isFinite(q)||q<0||!Number.isInteger(q))))||p.developments.some(d=>['id','itemNo','name','brand','season','supplier','sampleStatus','targetDate','sentDate','currency','remarks'].some(key=>typeof d[key as keyof Development]!=='string')||!Number.isFinite(d.price)||d.price<0)||Object.values(p.productNotes).some(n=>[n.brand,n.season,n.remarks].some(v=>typeof v!=='string'))||Object.values(p.tracking).some(row=>Object.entries(row).some(([k,v])=>['bulk','internalFields'].includes(k)?!v||typeof v!=='object'||Array.isArray(v)||Object.values(v).some(x=>typeof x!=='string'):typeof v!=='string')))throw new Error('工作站備份資料不完整');
  if(p.shipments.some(s=>s.factoryNotice!==undefined&&(!s.factoryNotice||typeof s.factoryNotice!=='object'||Array.isArray(s.factoryNotice)||Object.values(s.factoryNotice).some(v=>typeof v!=='string'))))throw new Error('工廠出貨通知資料格式不符');
  if(Object.entries(p.productNotes).some(([code,n])=>!code||['__proto__','constructor','prototype'].includes(code)||[n.customerPrice,n.factoryPrice].some(v=>v!==undefined&&(!Number.isFinite(v)||v<0))||['name','spec','chineseName','chineseSpec','createdFromPo','series','customerCurrency','supplierCode','factoryCurrency'].some(k=>n[k as keyof ProductNote]!==undefined&&typeof n[k as keyof ProductNote]!=='string')||n.archived!==undefined&&typeof n.archived!=='boolean'||n.photo!==undefined&&(typeof n.photo!=='string'||n.photo.length>1400000||!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(n.photo))))throw new Error('款式資料或照片格式不符');
  if(Object.values(p.productNotes).some(n=>n.colorTranslations!==undefined&&(!n.colorTranslations||typeof n.colorTranslations!=='object'||Array.isArray(n.colorTranslations)||Object.entries(n.colorTranslations).some(([key,value])=>['__proto__','constructor','prototype'].includes(key)||typeof value!=='string'))))throw new Error('中文色名格式不符');
  if(Object.values(p.productNotes).some(n=>n.prices!==undefined&&(!Array.isArray(n.prices)||new Set(n.prices.map(q=>q.id)).size!==n.prices.length||n.prices.some(q=>!q||!q.id||!['customer','factory'].includes(q.kind)||!Number.isFinite(q.price)||q.price<0||['id','party','date','currency','unit','remarks','createdAt'].some(k=>typeof q[k as keyof ProductPrice]!=='string')||['partyName','source','document'].some(k=>q[k as keyof ProductPrice]!==undefined&&typeof q[k as keyof ProductPrice]!=='string')||!q.party.trim()||!q.currency.trim()||!q.unit.trim()||q.date!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(q.date)))||n.withdrawnPrices!==undefined&&(!n.withdrawnPrices||typeof n.withdrawnPrices!=='object'||Array.isArray(n.withdrawnPrices)||Object.values(n.withdrawnPrices).some(reason=>typeof reason!=='string'||!reason.trim()))))throw new Error('價格歷史資料格式不符');
  if(p.shipments.some(s=>s.lines.some(l=>l.packingRows!==undefined&&(!Array.isArray(l.packingRows)||l.packingRows.some(r=>!r||typeof r.id!=='string'||typeof r.measurement!=='string'||[r.from,r.to,r.netWeight,r.grossWeight,r.cbm].some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0)||!r.sizes||Object.values(r.sizes).some(q=>typeof q!=='number'||!Number.isInteger(q)||q<0))))))throw new Error('逐箱裝箱明細格式不符');
  if(p.shipments.some(s=>s.confirmed&&shipmentIssues(s,p.shipments,p.orders.find(o=>o.poNumber===s.poNumber)).length))throw new Error('工作站備份的已確認出貨需重新核對');
  w=p;
 }
 return current&&!w.removedOrders?.[current.poNumber]?upsertOrder(w,current):normalizeWorkspace(w);
}
export function seasonOf(style:string){const m=style.toUpperCase().match(/\d([SW])(\d{2})$/);return m?`${m[1]==='W'?'FW':'SS'}${m[1]==='S'&&['04','06'].includes(m[2])?({'04':'24','06':'26'} as Record<string,string>)[m[2]]:m[2]}`:style.endsWith('CO')?'常態款':'';}
export function brandOf(value:string){const text=value.trim().replace(/\s+/g,' ');const known=['ABC','BEST COMPANY','8848','ARENA','ADMIRAL','FILA','ELLESSE','REUSCH','MISTRAL','BEAR'];return known.find(b=>new RegExp(`(?:^|\\s)${b}(?:\\s|$)`,'i').test(text))||text;}
export function sourceLabels(...values:string[]){return [...new Set(values.flatMap(v=>v.split(' / ')).map(v=>v.trim()).filter(Boolean))].join(' / ');}
export function trackingRows(w:Workspace,refs:ReferenceSnapshot|null,erp?:ErpSnapshot|null):TrackingRecord[]{
 const rows=new Map<string,TrackingRecord>();
 const closed=new Set(refs?.completedShipmentOrders||[]);
 for(const r of refs?.tracking||[]){const itemNo=verifiedTrackingStyle(r.poNumber,r.itemNo);rows.set(r.id,{...r,...w.tracking[r.id],itemNo,internalFields:{...r.internalFields,...(closed.has(JSON.stringify([r.scNumber,r.poNumber]))?{_shipmentClosed:'Y'}:{}),...w.tracking[r.id]?.internalFields,...(itemNo!==r.itemNo?{O:itemNo,_verifiedOriginalStyle:r.itemNo}: {})},bulk:{...r.bulk,...w.tracking[r.id]?.bulk}});}
 for(const original of w.orders){const o=sizeVariantOrder(original);for(const itemNo of [...new Set(o.items.map(pricingCode))]){
  const items=o.items.filter(i=>pricingCode(i)===itemNo),i=items[0];
  const candidates=[...rows.values()].filter(r=>r.poNumber===o.poNumber&&r.itemNo===itemNo&&r.scNumber===o.piNumber);const prior=candidates.length===1?candidates[0]:undefined;
  if(prior)rows.delete(prior.id);
  const id=`order:${o.poNumber}|${itemNo}`;
  rows.set(id,{unit:'PCS',season:seasonOf(itemNo),brand:'',status:'已匯入待核對',tp:'',labDip:'',fitSample:'',pps:'',fabricTestDate:'',fabricTestStatus:'待安排',cutting:'',sewing:'',shippingSample:'',inspection:'',packing:'',remarks:'',...prior,...w.tracking[prior?.id||''],...w.tracking[id],bulk:{...prior?.bulk,...w.tracking[prior?.id||'']?.bulk,...w.tracking[id]?.bulk},internalFields:{...(closed.has(JSON.stringify([o.piNumber,o.poNumber]))?{_shipmentClosed:'Y'}:{}),...prior?.internalFields,...w.tracking[prior?.id||'']?.internalFields,...w.tracking[id]?.internalFields},id,scNumber:o.piNumber,poNumber:o.poNumber,itemNo,company:o.orderingCompany||o.customerName,supplier:items.map(i=>i.factoryProduct?.supplier||o.factorySupplier||prior?.supplier||'').filter((s,n,a)=>a.indexOf(s)===n).join(' / '),customerDate:o.shipmentDate,factoryDate:o.factoryShipDate,quantity:items.reduce((n,i)=>n+i.totalQuantity,0),source:o.sourceFileName||'本機 PO'});
 }}
 return normalizeTrackingFactories([...rows.values()].map(r=>{const synced=syncTracking(r,w),order=w.orders.find(o=>o.poNumber===r.poNumber&&o.piNumber===r.scNumber),series=cleanSeries(order?.series||r.series||r.internalFields?.E||r.brand),brand=canonicalBrand(order?.brand||r.internalFields?.D||brandOf(series));return {...synced,unit:trackingQuantityUnit(synced.unit),brand,series,internalFields:{...synced.internalFields,D:brand,E:series,C:synced.season}};}),erp);
}
export function shipmentQuantity(s:ShipmentLine){return Object.values(s.sizes).reduce((a,b)=>a+b,0);}
export function newShipment(o:OrderData,id:string):Shipment{return {id,poNumber:o.poNumber,scNumber:o.piNumber,customer:o.customerName,address:o.deliveryAddress||o.customerAddress,invoiceNo:`${o.piNumber}-${id.slice(-6)}`,date:'',vessel:'',container:'',fromPort:o.port,toPort:'',remarks:'',confirmed:false,lines:o.items.flatMap(i=>i.colors.map(c=>({id:`${i.id}:${c.id}`,itemNo:i.itemNo,description:i.description||i.styleName,color:`${c.colorCode} ${c.colorName}`,unit:i.factoryProduct?.unit==='雙'||i.itemNo==='ABCRA07'?'PAIRS':'PCS',planned:c.totalQuantity,sizes:Object.fromEntries(i.sizes.map(size=>[size,0])),unitPriceUSD:i.unitPriceUSD,supplier:i.factoryProduct?.supplier||o.factorySupplier,cartons:0,netWeight:0,grossWeight:0,cbm:0}))) };}
export function shipmentIssues(s:Shipment,all:Shipment[]=[],order?:OrderData){
 const issues:string[]=[...shipmentSelectionIssues(s)];
 if(s.factoryNotice?.lcEntries)try{for(const l of s.lines.filter(l=>shipmentQuantity(l)>0))lcForLine(s,l.id);}catch(e){issues.push(e instanceof Error?e.message:String(e));}
 if(s.lines.some(l=>l.packingRows?.length))issues.push(...packingIssues(s));
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||Number.isNaN(Date.parse(s.date))||new Date(s.date).toISOString().slice(0,10)!==s.date)issues.push('請填有效的實際出貨日期');
 if(!s.invoiceNo.trim())issues.push('請填 Invoice 號碼');
 if(!s.customer.trim())issues.push('請填客戶名稱');
 if(all.some(x=>x.id!==s.id&&x.confirmed&&x.invoiceNo.trim()===s.invoiceNo.trim()))issues.push('Invoice 號碼已被其他已確認出貨使用');
 if(!s.lines.some(l=>shipmentQuantity(l)>0))issues.push('請填實際出貨尺碼數量');
 for(const l of s.lines){
  if(Object.values(l.sizes).some(q=>!Number.isFinite(q)||q<0||!Number.isInteger(q)))issues.push(`${l.itemNo}：數量須為非負整數`);
  if(shipmentQuantity(l)===0)continue;
  if(!Number.isFinite(l.unitPriceUSD)||l.unitPriceUSD<=0)issues.push(`${l.itemNo}：客戶售價待確認`);
  if(!Number.isInteger(l.cartons)||l.cartons<=0||!Number.isFinite(l.netWeight)||l.netWeight<=0||!Number.isFinite(l.grossWeight)||l.grossWeight<l.netWeight||!Number.isFinite(l.cbm)||l.cbm<=0)issues.push(`${l.itemNo} / ${l.color}：請核對箱數、淨重、毛重與材積`);
  if(order){const colors=order.items.filter(i=>i.itemNo===l.itemNo).flatMap(i=>i.colors).filter(c=>`${c.colorCode} ${c.colorName}`===l.color);for(const size of Object.keys(l.sizes)){const shipped=all.filter(x=>x.id!==s.id&&x.confirmed&&x.poNumber===s.poNumber).flatMap(x=>x.lines).filter(x=>x.itemNo===l.itemNo&&x.color===l.color).reduce((n,x)=>n+(x.sizes[size]||0),0);const current=s.lines.filter(x=>x.itemNo===l.itemNo&&x.color===l.color).reduce((n,x)=>n+(x.sizes[size]||0),0);if(current+shipped>colors.reduce((n,c)=>n+(c.quantitiesBySize[size]||0),0))issues.push(`${l.itemNo} / ${l.color} / ${size}：累計出貨超過 PO 數量`);}}
 }
 return [...new Set(issues)];
}
export function quarterOf(value:string){const m=value.match(/^(\d{4})-(\d{2})-(\d{2})/),d=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);const year=m?.[1]||d?.[3],month=Number(m?.[2]||d?.[2]);return year&&month>=1&&month<=12?`${year} Q${Math.ceil(month/3)}`:'日期待核對';}
export function analytics(w:Workspace){
 const orders=new Map<string,{quarter:string;season:string;customer:string;quantity:number;amount:number;count:number}>(),shipments=new Map<string,{quarter:string;season:string;customer:string;quantity:number;amount:number;count:number}>();
 for(const o of w.orders){const quarter=quarterOf(o.poDate),season=o.season||'季度待填',customer=o.orderingCompany||o.customerName,key=`${season}|${quarter}|${customer}`;const r=orders.get(key)||{quarter,season,customer,quantity:0,amount:0,count:0};r.count++;r.quantity+=o.totalPieces;r.amount+=o.items.reduce((n,i)=>n+i.totalQuantity*i.unitPriceUSD,0);orders.set(key,r);}
 for(const s of w.shipments.filter(x=>x.confirmed)){const quarter=quarterOf(s.date),order=w.orders.find(o=>o.poNumber===s.poNumber),season=order?.season||'季度待填',customer=order?.orderingCompany||s.customer,key=`${season}|${quarter}|${customer}`;const r=shipments.get(key)||{quarter,season,customer,quantity:0,amount:0,count:0};r.count++;r.quantity+=s.lines.reduce((n,l)=>n+shipmentQuantity(l),0);r.amount+=s.lines.reduce((n,l)=>n+shipmentQuantity(l)*l.unitPriceUSD,0);shipments.set(key,r);}
 return {orders:[...orders.values()],shipments:[...shipments.values()]};
}
