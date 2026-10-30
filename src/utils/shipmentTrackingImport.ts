import {setOrderLc} from './shipmentLc';
import * as XLSX from 'xlsx';
import type {OrderData} from '../types/order';
import type {TrackingRecord,Workspace} from './workspace';
import {shipmentTrackingFields,shipmentTrackingHeaders,shipmentTrackingColumns,shipmentTrackingKey,shipmentTrackingLabels,shipmentTrackingVisibleData,shipmentTrackingMetricsLocked,trackingDateText} from './shipmentTracking';
export interface ShipmentTrackingChange {id:string;key:string;po:string;style:string;field:string;label:string;before:string;after:string;store:string}
export interface ShipmentTrackingImport {changes:ShipmentTrackingChange[];errors:string[];matched:number}
const keyOf=(r:TrackingRecord)=>shipmentTrackingKey(r);
function cellText(c:XLSX.CellObject|undefined){if(!c)return '';if(c.t==='e')throw Error('儲存格含 Excel 錯誤');return String(c.v??'').trim();}
function normalize(c:XLSX.CellObject|undefined,index:number){
 if(!c||c.v===undefined||c.v===null||c.v==='')return '';
 if(c.f)throw Error('回填欄請填值，不要填公式');
 if([5,6].includes(index)){
  const raw=c.v;let text=raw instanceof Date?trackingDateText(raw):typeof raw==='number'?(()=>{return Number.isFinite(raw)&&raw>60&&raw<2958466?new Date(Date.UTC(1899,11,30)+Math.floor(raw)*86400000).toISOString().slice(0,10):'';})():trackingDateText(String(raw).trim());
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text)||isNaN(Date.parse(text))||new Date(text).toISOString().slice(0,10)!==text)throw Error('日期請使用 Excel 日期或 YYYY-MM-DD / DD/MM/YYYY');return text;
 }
 if([7,8,9].includes(index)){const n=Number(c.v);if(!Number.isFinite(n)||n<0||(index===7&&!Number.isInteger(n)))throw Error('箱數須為非負整數，重量及材積須為非負數');return String(n);}
 const text=cellText(c);if(text.length>2000)throw Error('文字超過 2000 字');return text;
}
export function planShipmentTrackingImport(bytes:ArrayBuffer|Uint8Array,rows:TrackingRecord[],w:Workspace,orders:OrderData[]=[]):ShipmentTrackingImport{
 const book=XLSX.read(bytes,{type:'array',cellDates:false}),sheet=book.Sheets.CSQ,meta=book.Sheets._CSQ,errors:string[]=[],changes:ShipmentTrackingChange[]=[];
 if(book.Workbook?.WBProps?.date1904)throw Error('請保留匯出檔的日期系統，不要改成 1904 日期系統。');
 if(!sheet||meta?.A1?.v!=='CSQ-SHIPMENT-TRACKING-1')throw Error('請選擇新版工作站匯出的 Order Tracking Sheet，並保留隱藏的回讀資料。');
 if(shipmentTrackingColumns.some((c,i)=>cellText(sheet[XLSX.utils.encode_cell({r:6,c:i})])!==shipmentTrackingHeaders[c]))throw Error('表頭或欄位順序已變動，請保留匯出格式。');
 const originals=new Map<string,{quantity:number;values:string[];}>();
 for(let r=2;r<=Math.min(3002,XLSX.utils.decode_range(meta['!ref']||'A1').e.r+1);r++){const raw=meta['A'+r]?.v;if(!raw)continue;const o=JSON.parse(String(raw));if(typeof o.key!=='string'||!Array.isArray(o.values)||o.values.length!==12||originals.has(o.key))throw Error('回讀對應資料損毀或重複，請重新匯出。');originals.set(o.key,o);}
 const current=new Map(shipmentTrackingVisibleData(rows,w,orders).map(d=>[keyOf(d.record),d])),seen=new Set<string>();let matched=0;
 const end=XLSX.utils.decode_range(sheet['!ref']||'A1').e.r+1;if(end>10000)throw Error('檔案超過 10000 列，請先移除多餘列。');
 for(let r=8;r<=end;r++){
  const at=(c:number)=>sheet[XLSX.utils.encode_cell({r:r-1,c})];if(cellText(at(0))==='TOTAL')continue;
  const identity=[1,2,3].map(c=>cellText(at(c)));if(identity.every(v=>!v)&&Array.from({length:12},(_,c)=>cellText(at(c))).every(v=>!v))continue;
  const key=JSON.stringify(identity),original=originals.get(key),entry=current.get(key);const rowError=(s:string)=>errors.push(`第 ${r} 列（${identity[1]} / ${identity[2]}）：${s}`);
  if(!original||!entry){rowError('找不到相同 S/C＋PO＋品號，請勿修改識別欄。');continue;}if(seen.has(key)){rowError('同一款式重複，請勿複製明細列。');continue;}seen.add(key);matched++;
  if(Number(at(4)?.v)!==original.quantity||entry.record.quantity!==original.quantity){rowError('訂單數量已變動，請重新匯出；不能由追蹤表改 PO 數量。');continue;}
  if(at(10)?.f||cellText(at(10))!==original.values[10])rowError('工廠代碼由訂單帶入，請勿修改或填入公式。');
  const planned:ShipmentTrackingChange[]=[];
  for(const [index,field]of Object.entries(shipmentTrackingFields)){const c=Number(index);try{
   const cell=at(c);
   const after=normalize(cell,c),before=original.values[c],now=[5,6].includes(c)?trackingDateText(entry.values[c]):String(entry.values[c]);
   // Merged metrics belong to the first row only; empty sibling cells are not deletions.
   if([7,8,9].includes(c)&&entry.metricsKey!==JSON.stringify([entry.record.poNumber,entry.record.scNumber,entry.record.itemNo])){const merge=sheet['!merges']?.find(m=>m.s.c===c&&m.e.c===c&&r-1>m.s.r&&r-1<=m.e.r);if(merge)continue;}
   if(after===before)continue;
   if([7,8,9].includes(c)&&shipmentTrackingMetricsLocked(entry.record,w))throw Error('已有正式出貨資料，請在出貨批次修改裝箱資料');
   if(now!==before&&now!==after)throw Error('匯出後工作站已有其他修改，請重新匯出後核對');
   if(now!==after)planned.push({id:entry.record.id,key,po:entry.record.poNumber,style:entry.record.itemNo,field,label:shipmentTrackingLabels[c],before:now,after,store:after});
  }catch(e){rowError(`${shipmentTrackingLabels[c]}：${e instanceof Error?e.message:String(e)}`);}}
  for(const change of planned){if(['shipmentCartons','shipmentGrossWeight','shipmentCbm'].includes(change.field)){for(const target of current.values())if(target.metricsKey===entry.metricsKey)changes.push({...change,id:target.record.id,key:keyOf(target.record),style:target.record.itemNo});}else changes.push(change);}
 }
 const lcGroups=new Map<string,ShipmentTrackingChange[]>();for(const c of changes.filter(c=>c.field==='shipmentLc')){const key=JSON.stringify(JSON.parse(c.key).slice(0,2));lcGroups.set(key,[...(lcGroups.get(key)||[]),c]);}
 for(const group of lcGroups.values()){const first=group[0],[sc,po]=JSON.parse(first.key);if(new Set(group.map(c=>c.after)).size>1){errors.push(po+'：同張 PO 填了不同 L/C，請統一號碼；每張 PO 只能對應一個 L/C。');continue;}try{setOrderLc(w,rows,po,sc,first.after);}catch(e){errors.push(po+'：'+(e instanceof Error?e.message:String(e)));continue;}for(let i=changes.length-1;i>=0;i--)if(group.includes(changes[i]))changes.splice(i,1);for(const target of current.values())if(target.record.poNumber===po&&target.record.scNumber===sc&&String(target.values[11])!==first.after)changes.push({...first,id:target.record.id,key:keyOf(target.record),style:target.record.itemNo,before:String(target.values[11])});}
 if(!matched&&!errors.length)errors.push('檔案沒有可配對的款式。');return {changes,errors,matched};
}
export function applyShipmentTrackingChanges(w:Workspace,plan:ShipmentTrackingImport,rows:TrackingRecord[]=[]):Workspace{
 if(plan.errors.length)throw Error('請先處理回讀錯誤。');const tracking={...w.tracking};for(const c of plan.changes)tracking[c.id]={...tracking[c.id],bulk:{...tracking[c.id]?.bulk,[c.field]:c.store}};let next={...w,tracking};const seen=new Set<string>();for(const c of plan.changes.filter(c=>c.field==='shipmentLc')){const [sc,po]=JSON.parse(c.key),key=JSON.stringify([sc,po]);if(seen.has(key))continue;seen.add(key);next=setOrderLc(next,rows,po,sc,c.store);}return next;
}


