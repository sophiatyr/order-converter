import {buildCustomerBulk} from './trackingDocuments';
import type {TrackingRecord} from './workspace';
import type {GeneratedDownload} from './excelExport';
const serial=(d:Date)=>(d.getTime()-Date.UTC(1899,11,30))/86400000;
const englishName=(value:string|undefined)=>{const text=(value||'').trim();return !/[\u3400-\u9fff]/.test(text)&&/[A-Za-z]/.test(text)&&text.length>8&&/\s/.test(text)?text:'';};
const factoryKey=(r:TrackingRecord)=>(r.supplierCode||r.internalFields?.J||r.supplier).trim().toUpperCase();
export function customerFactoryName(row:TrackingRecord,directory:TrackingRecord[]){
 const explicit=englishName(row.bulk?.factoryName);if(explicit)return explicit;
 const key=factoryKey(row),names=new Map<string,string>();
 for(const r of directory)if(key&&factoryKey(r)===key){const name=englishName(r.bulk?.factoryName);if(name)names.set(name.toUpperCase().replace(/[^A-Z0-9]/g,''),name);}
 if(names.size===1)return [...names.values()][0];
 return englishName(row.internalFields?.K)||englishName(row.supplierName)||englishName(row.supplier);
}
export function customerTemplatePreview(rows:TrackingRecord[],week:string,directory:TrackingRecord[]=rows){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(week)||Number.isNaN(Date.parse(week))||new Date(week).toISOString().slice(0,10)!==week)throw Error('請選擇有效的報告日期。');
 const sheet=buildCustomerBulk(rows,[],week).worksheets[0],values:(string|number|null)[][]=[];
 const missing=new Set<string>();
 for(let r=6;r<=sheet.rowCount;r++){
  const record=rows[r-6],factory=record?customerFactoryName(record,directory):'';
  if(!factory)missing.add(record?`${record.poNumber} / ${factoryKey(record)||record.itemNo}`:'未對應工廠');
  values.push(Array.from({length:45},(_,c)=>{if(c===0)return 'SPORTS KITE';if(c===9)return factory;const value=sheet.getCell(r,c+1).value;return value instanceof Date?serial(value):typeof value==='string'||typeof value==='number'?value:null;}));
 }
 return {rows:values,week:serial(new Date(week+'T00:00:00Z')),missingFactories:[...missing]};
}
export function customerTemplatePayload(rows:TrackingRecord[],week:string,directory:TrackingRecord[]=rows){
 const preview=customerTemplatePreview(rows,week,directory);
 if(preview.missingFactories.length)throw Error(`以下訂單缺少可核對的工廠英文名稱，請在客戶進度編輯中填入 Factory Name：${preview.missingFactories.join('、')}`);
 if(preview.rows.length>995)throw Error('客戶原表最多 995 筆，請縮小篩選範圍後匯出。');
 return {rows:preview.rows,week:preview.week};
}
export async function exportCustomerBulkTemplate(rows:TrackingRecord[],week:string,directory:TrackingRecord[]=rows):Promise<GeneratedDownload>{
 const health=await fetch('/api/local-health',{cache:'no-store'});
 if(!health.ok||(await health.json()).app!=='order-converter-local')throw Error('客戶原表需在本機 8888 透過 Excel 匯出。請在本機工作站開啟相同訂單資料後再匯出。');
 const response=await fetch('/api/local-customer-bulk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(customerTemplatePayload(rows,week,directory))});
 if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||'客戶原表匯出失敗，請確認本機 Excel 能正常開啟原檔。');}
 const url=URL.createObjectURL(await response.blob()),filename=`BULK_STATUS_SPORTSKITE_PILOT_${week}.xlsx`,anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();return {url,filename};
}
