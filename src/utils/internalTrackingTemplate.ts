import type {TrackingRecord,Workspace} from './workspace';
import type {GeneratedDownload} from './excelExport';
import {internalValues} from './trackingDocuments';
import {columnKey} from './trackingFields';
import {verifiedTrackingAliases} from './verifiedTrackingStyles';
import {sortTrackingRows} from './trackingSort';
const numeric=new Set(['H','L','M','N','P','V','AP']);
const dates=new Set(['R','S','T','U','W','X','Y','Z','AA','AB','AC','AD','AE','AF','AG','AH','AI','AJ','AK','AL','AM','AN','AR','AS','AT']);
function value(key:string,input:string):string|number|null {
 if(input==='')return null;
 if(numeric.has(key))return Number.isFinite(Number(input))?Number(input):input;
 if(dates.has(key)){
  const match=input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/),iso=match?`${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`:input;
  if(/^\d{4}-\d{2}-\d{2}$/.test(iso)&&!Number.isNaN(Date.parse(iso))&&new Date(iso).toISOString().slice(0,10)===iso)return (Date.parse(iso)-Date.UTC(1899,11,30))/86400000;
 }
 return input;
}
export function internalTemplatePayload(selected:TrackingRecord[],directory:TrackingRecord[],workspace:Workspace){
 const orders=new Set(selected.map(r=>JSON.stringify([r.scNumber,r.poNumber])));
 // Full POs preserve merged order/factory totals and mixed-currency formulas.
 const rows=sortTrackingRows(directory.filter(r=>r.color===undefined&&orders.has(JSON.stringify([r.scNumber,r.poNumber]))),workspace);
 if(!rows.length||rows.length>3000)throw Error('請選擇 1 至 3000 筆內部追蹤明細。');
 return {rows:rows.map(r=>{
  const fields:Record<string,string>={...internalValues(r),A:r.scNumber,B:r.poNumber,O:r.itemNo,P:String(r.quantity)},order=workspace.orders.find(o=>o.poNumber===r.poNumber&&o.piNumber===r.scNumber),rate=order?.rmbPerUsd||Number(fields._rmbPerUsd)||null;
  return {id:r.id,sc:r.scNumber,po:r.poNumber,style:r.itemNo,aliases:verifiedTrackingAliases(r.poNumber,r.itemNo),factory:fields.J||r.supplier,currency:fields._costCurrency||'',rate,scopes:Object.fromEntries(['H','L','M','N'].map(c=>[c,fields['_scope'+c]||`${r.scNumber}|${r.poNumber}|${c==='H'||c==='N'?'order':fields.J||r.supplier}`])),values:Array.from({length:46},(_,c)=>value(columnKey(c),fields[columnKey(c)]||''))};})};
}
export async function createInternalTrackingTemplate(selected:TrackingRecord[],directory:TrackingRecord[],workspace:Workspace):Promise<Uint8Array>{
 const [source,meta]=await Promise.all([fetch(import.meta.env.BASE_URL+'csq-internal-tracking-template.xlsx',{cache:'no-store'}),fetch(import.meta.env.BASE_URL+'csq-internal-tracking-template.json',{cache:'no-store'})]);
 if(!source.ok||!meta.ok)throw Error('內部追蹤原表範本尚未更新，請更新工作站程式。');
 const {buildPortableInternalTracking}=await import('./internalTrackingPortable');
 const bytes=await buildPortableInternalTracking(await source.arrayBuffer(),await meta.json(),internalTemplatePayload(selected,directory,workspace));
 return bytes;
}
export async function exportInternalTrackingTemplate(selected:TrackingRecord[],directory:TrackingRecord[],workspace:Workspace,week:string):Promise<GeneratedDownload>{
 const bytes=await createInternalTrackingTemplate(selected,directory,workspace);
 const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),filename=`訂單進度_${week}.xlsx`,anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();return {url,filename};
}
