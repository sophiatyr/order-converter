import * as XLSX from 'xlsx';
import type {TrackingRecord,Workspace} from './workspace';
import {bulkPhases,columnKey,internalLabels} from './trackingFields';
import {internalValues} from './trackingDocuments';
import {customerTemplatePreview} from './customerBulkTemplate';
import {updateTrackingInput} from './trackingProgress';

export type TrackingImportKind='internal'|'customer';
export interface TrackingExcelChange {id:string;po:string;style:string;color:string;group:'bulk'|'internalFields';field:string;label:string;before:string;after:string}
export interface TrackingExcelPlan {kind:TrackingImportKind;matched:number;changes:TrackingExcelChange[];errors:string[]}
type Field={c:number;group:'bulk'|'internalFields';field:string;label:string;date?:boolean;statuses?:readonly string[]};
const internalDates=new Set(['W','X','Y','Z','AA','AB','AC','AD','AE','AF','AG','AH','AI','AJ','AL','AM','AN','AR','AS','AT']);
// PO identity, quantities, prices, formulas and actual shipment cells remain source-owned.
const internalFields:Field[]=internalLabels.flatMap((label,c)=>{
 const field=columnKey(c);return ['G',...internalDates].includes(field)?[{c,field,label,group:'internalFields' as const,date:internalDates.has(field)}]:[];
});
const customerFields:Field[]=[{c:7,group:'bulk',field:'confirmedDate',label:'ETD CONFIRMED',date:true},{c:9,group:'bulk',field:'factoryName',label:'Factory Name（英文）'},{c:10,group:'bulk',field:'contact',label:'客戶聯絡人'},{c:11,group:'bulk',field:'customerItem',label:'Item Number'},{c:12,group:'bulk',field:'description',label:'Product Description'}];
let nextCol=13;
for(const [phase,label,,statuses] of bulkPhases){if(phase==='cutting')nextCol++;if(phase!=='shipment')customerFields.push({c:nextCol,group:'bulk',field:phase+'Date',label:label+' 日期',date:true},{c:nextCol+1,group:'bulk',field:phase+'Status',label:label+' 狀態',statuses});if(phase==='shippingSample')customerFields.push({c:nextCol+2,group:'bulk',field:'shippingApprovalDate',label:'船樣核准日期',date:true});nextCol+=phase==='shippingSample'?3:2;}
const fieldsFor=(kind:TrackingImportKind)=>kind==='internal'?internalFields:customerFields;
const text=(cell:XLSX.CellObject|undefined)=>String(cell?.v??'').trim();
export function trackingImportValue(cell:XLSX.CellObject|undefined,date=false){
 if(cell?.t==='e')throw Error('儲存格含 Excel 錯誤');
 if(cell?.f)throw Error('回填欄請填值，不可填公式');
 if(!cell||cell.v===null||cell.v===undefined||cell.v==='')return '';
 if(!date){const v=text(cell);if(v.length>2000)throw Error('文字不可超過 2000 字');return v;}
 let v=text(cell);
 if(typeof cell.v==='number'){if(cell.v<=60||cell.v>=2958466)throw Error('日期超出範圍');v=new Date(Date.UTC(1899,11,30)+Math.floor(cell.v)*86400000).toISOString().slice(0,10);}
 const m=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m)v=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('日期請填 Excel 日期、YYYY-MM-DD 或 DD/MM/YYYY');return v;
}
function comparable(v:unknown,date=false){try{return trackingImportValue({v:v??'',t:typeof v==='number'?'n':'s'} as XLSX.CellObject,date);}catch{return String(v??'').trim();}}
export function planTrackingExcelImport(book:XLSX.WorkBook,kind:TrackingImportKind,rows:TrackingRecord[],directory:TrackingRecord[]=rows):TrackingExcelPlan{
 if(book.Workbook?.WBProps?.date1904)throw Error('不支援 1904 日期系統，請保留原匯出格式。');
 const sheet=book.Sheets[kind==='internal'?'CSQ':'CURRENT BULK'];if(!sheet)throw Error('請選擇'+(kind==='internal'?'內部訂單追蹤':'客戶進度表')+'匯出的原格式 Excel。');
 const at=(r:number,c:number)=>sheet[XLSX.utils.encode_cell({r:r-1,c})];
 const start=kind==='internal'?5:6;
 if(kind==='internal'?(text(at(2,0))!=='P/I NO.'||text(at(2,1))!=='S/C NO.'):(text(at(5,2))!=='STYLE'||text(at(5,4))!=='PO NUMBER'||text(at(5,31))!=='RESULT – AUTO'))throw Error('表頭或欄位順序已改動，請保留原匯出格式。');
 const end=XLSX.utils.decode_range(sheet['!ref']||'A1').e.r+1;if(end>10000)throw Error('檔案超過 10000 列。');
 const key=(r:TrackingRecord)=>JSON.stringify(kind==='internal'?[r.scNumber,r.poNumber,r.itemNo]:[r.poNumber,r.itemNo,r.bulk?.color??r.color??'']);
 const candidates=new Map<string,TrackingRecord[]>();for(const r of rows)candidates.set(key(r),[...(candidates.get(key(r))||[]),r]);
 const customerValues=kind==='customer'?customerTemplatePreview(rows,'2026-01-01',directory).rows:[];
 const current=new Map(rows.map((r,i)=>[r.id,kind==='internal'?Array.from({length:46},(_,c)=>internalValues(r)[columnKey(c)]||''):customerValues[i]]));
 const errors:string[]=[],changes:TrackingExcelChange[]=[],seen=new Set<string>(),shared=new Map<string,Set<string>>();let matched=0;
 for(let n=start;n<=end;n++){
  const identity=(kind==='internal'?[0,1,14]:[4,2,3]).map(c=>text(at(n,c)));if(identity.every(v=>!v))continue;
  const k=JSON.stringify(identity),matches=candidates.get(k)||[];const error=(s:string)=>errors.push(`第 ${n} 列（${identity.join(' / ')}）：${s}`);
  if(matches.length!==1){error(matches.length?'配對不唯一，請核對工廠及款號。':'找不到相同訂單／款號／顏色，請勿修改識別欄。');continue;}
  const r=matches[0];if(seen.has(k)){error('重複明細列。');continue;}seen.add(k);matched++;
  const qty=at(n,kind==='internal'?15:8);if(qty?.f||Number(qty?.v)!==r.quantity){error('訂單數量不符，請重新匯出；PO 數量請在訂單作業修改。');continue;}
  for(const f of fieldsFor(kind)){try{
   const merge=sheet['!merges']?.find(m=>m.s.c===f.c&&m.e.c===f.c&&n-1>m.s.r&&n-1<=m.e.r);if(merge)continue;
   const cell=at(n,f.c),date=f.date&&(kind==='customer'||['W','AA','AB','AC','AD','AF','AH'].includes(f.field)||typeof cell?.v==='number'||/^\d{4}-|^\d{1,2}\//.test(text(cell)));
   const after=trackingImportValue(cell,date),before=comparable(current.get(r.id)?.[f.c],f.date);
   if(kind==='customer'&&bulkPhases.some(([phase])=>phase!=='shipment'&&[phase+'Date',phase+'Status'].includes(f.field))){const group=JSON.stringify([r.id.split(':colour:')[0],f.field]);shared.set(group,new Set([...(shared.get(group)||[]),after]));}
   if(after===before)continue;
   if(f.statuses&&after&&!f.statuses.includes(after))throw Error('狀態不在原表選單中');
   if(f.field==='factoryName'&&after&&(/[\u3400-\u9fff]/.test(after)||!/[A-Za-z]/.test(after)))throw Error('工廠名稱請填英文');
   changes.push({id:r.id,po:r.poNumber,style:r.itemNo,color:r.color||'',group:f.group,field:f.field,label:f.label,before,after});
  }catch(e){error(f.label+'：'+(e instanceof Error?e.message:String(e)));}}
 }
 if(kind==='customer')for(const c of changes){const sharedKey=JSON.stringify([c.id.split(':colour:')[0],c.field]);if(shared.has(sharedKey)&&(shared.get(sharedKey)!.size>1||rows.filter(r=>r.id.split(':colour:')[0]===c.id.split(':colour:')[0]).some(r=>!seen.has(key(r)))))errors.push(`${c.po} / ${c.style} ${c.label}：共用進度請保留全部顏色並填寫相同內容，才能同步內部追蹤。`);}
 if(!matched&&!errors.length)errors.push('檔案沒有可配對的明細。');
 return {kind,matched,changes,errors};
}
export function applyTrackingExcelImport(w:Workspace,plan:TrackingExcelPlan,rows:TrackingRecord[],directory:TrackingRecord[]=rows){
 if(plan.errors.length)throw Error('請先修正 Excel 中的錯誤。');
 const currentValues=plan.kind==='customer'?customerTemplatePreview(rows,'2026-01-01',directory).rows:[];
 // Check the entire plan before applying anything, including updates received while the dialog was open.
 for(const c of plan.changes){const index=rows.findIndex(r=>r.id===c.id),r=rows[index],f=fieldsFor(plan.kind).find(f=>f.field===c.field)!;if(!r)throw Error('訂單資料已變動，請重新回讀。');const now=comparable(plan.kind==='internal'?internalValues(r)[c.field]:currentValues[index][f.c],f.date);if(now!==c.before)throw Error('核對期間工作站已有修改，請重新回讀。');}
 let next=w;for(const c of plan.changes){let r=rows.find(r=>r.id===c.id)!;if(plan.kind==='customer'&&bulkPhases.some(([phase])=>phase!=='shipment'&&[phase+'Date',phase+'Status'].includes(c.field)))r=directory.find(p=>p.id===c.id.split(':colour:')[0])||r;next=updateTrackingInput(next,r,c.group,c.field,c.after);}return next;
}
export async function readTrackingExcel(file:File):Promise<XLSX.WorkBook>{
 if(file.size>20*1024*1024)throw Error('檔案不可超過 20 MB。');
 const bytes=await file.arrayBuffer();
 try{return XLSX.read(bytes,{type:'array',cellDates:false});}catch{
  // Customer's rights-managed original remains intact; the installed Excel reads it with current user access.
  const response=await fetch('/api/local-tracking-read',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:bytes});
  const data=await response.json().catch(()=>({}));if(!response.ok||!data.Sheets)throw Error(data.error||'此檔案需在已登入 Excel 的本機工作站回讀；請確認 Excel 可正常開啟。');return data;
 }
}
