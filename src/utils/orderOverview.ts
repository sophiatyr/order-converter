import type {OrderData} from '../types/order';
import {trackingRows,type Workspace,type ReferenceSnapshot} from './workspace';
import type {ErpSnapshot} from './erpProducts';
import {canonicalBrand,canonicalSeries,canonicalSeason,normalizeClassification} from './classification';
import {trackingFactoryCode} from './shipmentFactorySearch';
export const overviewParts=(values:(string|undefined)[])=>[...new Set(values.flatMap(v=>(v||'').split(' / ')).map(v=>v.trim()).filter(Boolean))];
export function overviewDate(value:string){const d=value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/),iso=d?`${d[3]}-${d[2].padStart(2,'0')}-${d[1].padStart(2,'0')}`:value.trim();return /^\d{4}-\d{2}-\d{2}$/.test(iso)&&!isNaN(Date.parse(iso))&&new Date(iso).toISOString().slice(0,10)===iso?iso:'';}
export function overviewQuarter(value:string){const d=overviewDate(value);return d?`${d.slice(0,4)} Q${Math.ceil(Number(d.slice(5,7))/3)}`:'';}
export interface OrderOverviewRow {order:OrderData;brands:string[];series:string[];seasons:string[];factories:string[];factoryDates:string[];orderDate:string;quarter:string;styles:number;quantity:number;amount:number|null;saved:boolean}
export function orderOverviewRows(w:Workspace,refs:ReferenceSnapshot|null,erp?:ErpSnapshot|null):OrderOverviewRow[]{
 const source=new Map<string,OrderData>();for(const o of refs?.orders||[])if(!w.removedOrders?.[o.poNumber])source.set(o.poNumber,o);for(const o of w.orders)source.set(o.poNumber,o);
 const tracks=new Map<string,ReturnType<typeof trackingRows>>();for(const r of trackingRows(w,refs,erp)){const key=JSON.stringify([r.scNumber,r.poNumber]);tracks.set(key,[...(tracks.get(key)||[]),r]);}
 return [...source.values()].map(raw=>{const order=normalizeClassification(raw),rows=tracks.get(JSON.stringify([order.piNumber,order.poNumber]))||[],factories=overviewParts(rows.map(r=>trackingFactoryCode(r,[order])).concat(order.items.flatMap(i=>i.factoryProduct?.supplierCode||i.factoryPriceRecord?.party||[]))); 
  return {order,brands:overviewParts(order.brand?[canonicalBrand(order.brand)]:rows.map(r=>canonicalBrand(r.brand))),series:overviewParts(order.series?[canonicalSeries(order.series)]:rows.map(r=>canonicalSeries(r.series||''))),seasons:overviewParts(order.season?[canonicalSeason(order.season)]:rows.map(r=>canonicalSeason(r.season))),factories:factories.length?factories:overviewParts([order.supplierCode]),factoryDates:overviewParts(overviewParts([order.factoryShipDate||'',...rows.map(r=>r.factoryDate)]).map(d=>overviewDate(d)||d)),orderDate:overviewDate(order.poDate),quarter:overviewQuarter(order.poDate),styles:new Set(order.items.map(i=>i.itemNo)).size,quantity:order.totalPieces,amount:Number.isFinite(order.totalAmountUSD)?order.totalAmountUSD:null,saved:w.orders.some(o=>o.poNumber===order.poNumber)};
 });
}
export interface OrderOverviewFilters {query:string;season:string;brand:string;series:string;quarter:string;company:string;factory:string;sort:'po'|'date'}
const natural=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
export function filterOrderOverview(rows:OrderOverviewRow[],f:OrderOverviewFilters){return rows.filter(r=>{
 if(f.season&&!r.seasons.includes(f.season)||f.brand&&!r.brands.includes(f.brand)||f.series&&!r.series.includes(f.series)||f.quarter&&r.quarter!==f.quarter||f.company&&(r.order.orderingCompany||r.order.customerName)!==f.company||f.factory&&!r.factories.includes(f.factory))return false;
 const fields=[r.order.poNumber,r.order.piNumber,r.order.customerName,...r.brands,...r.series,...r.seasons,...r.factories,...r.order.items.map(i=>i.itemNo)].join(' ').normalize('NFKC').toUpperCase();return f.query.trim().normalize('NFKC').toUpperCase().split(/\s+/).every(t=>fields.includes(t));
 }).sort((a,b)=>{if(f.sort==='date'&&a.orderDate!==b.orderDate)return a.orderDate&&b.orderDate?b.orderDate.localeCompare(a.orderDate):a.orderDate?-1:1;const po=natural.compare(a.order.poNumber,b.order.poNumber);if(po)return po;const time=(o:OrderData)=>o.importedAt&&!isNaN(Date.parse(o.importedAt))?Date.parse(o.importedAt):Number.MAX_SAFE_INTEGER;return time(a.order)-time(b.order)||natural.compare(a.order.piNumber,b.order.piNumber);});}
