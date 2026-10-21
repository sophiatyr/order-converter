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
  const fields=internalValues(r),order=workspace.orders.find(o=>o.poNumber===r.poNumber&&o.piNumber===r.scNumber),rate=order?.rmbPerUsd||Number(fields._rmbPerUsd)||null;
  return {id:r.id,sc:r.scNumber,po:r.poNumber,style:r.itemNo,aliases:verifiedTrackingAliases(r.poNumber,r.itemNo),factory:fields.J||r.supplier,currency:fields._costCurrency||'',rate,scopes:Object.fromEntries(['H','L','M','N'].map(c=>[c,fields['_scope'+c]||`${r.scNumber}|${r.poNumber}|${c==='H'||c==='N'?'order':fields.J||r.supplier}`])),values:Array.from({length:46},(_,c)=>value(columnKey(c),fields[columnKey(c)]||''))};})};
}
export async function exportInternalTrackingTemplate(selected:TrackingRecord[],directory:TrackingRecord[],workspace:Workspace,week:string):Promise<GeneratedDownload>{
 const health=await fetch('/api/local-health',{cache:'no-store'});
 if(!health.ok||(await health.json()).app!=='order-converter-local')throw Error('內部原表需在本機 8888 透過 Excel 匯出，才能保留原有格式、合併欄位及公式。');
 const response=await fetch('/api/local-internal-tracking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(internalTemplatePayload(selected,directory,workspace))});
 if(!response.ok){const result=await response.json().catch(()=>({}));throw Error(result.error||'內部原表匯出失敗。');}
 const url=URL.createObjectURL(await response.blob()),filename=`訂單進度_${week}.xlsx`,anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();return {url,filename};
}
