import type {TrackingRecord} from './workspace';
export interface BulkProgressRow {row:number;po:string;style:string;quantity:number;customerDate:string;fields:Record<string,string>}
export interface BulkProgressSnapshot {source:string;capturedAt:string;rows:BulkProgressRow[]}
export function applyBulkProgress(rows:TrackingRecord[],source:BulkProgressSnapshot){
 const matched=new Set<number>(),issues:{po:string;style:string;reason:string;orderQuantity?:number;sourceQuantity?:number}[]=[];
 const result=rows.map(r=>{
  if(r.season!=='SS27')return r;
  const po=r.poNumber==='26OF043877'?'26OF043875':r.poNumber;
  let candidates=source.rows.filter(s=>s.po===po&&s.style===r.itemNo);
  if(candidates.length>1)candidates=candidates.filter(s=>s.customerDate===r.customerDate);
  if(candidates.length!==1){issues.push({po:r.poNumber,style:r.itemNo,reason:candidates.length?'原始 Bulk Status 有多筆不同進度，待核對':'原始 Bulk Status 未找到相符款式'});return r;}
  const s=candidates[0];matched.add(s.row);
  if(s.quantity!==r.quantity)issues.push({po:r.poNumber,style:r.itemNo,reason:'原始 Bulk Status 數量與訂單追蹤不同；保留訂單數量',orderQuantity:r.quantity,sourceQuantity:s.quantity});
  return {...r,bulk:{...r.bulk,...s.fields,_bulkSourceRow:String(s.row),_bulkSourceQuantity:String(s.quantity)},fabricTestDate:s.fields.fabricTestDate||r.fabricTestDate,fabricTestStatus:s.fields.fabricTestStatus==='APPROVED'?'PASS':s.fields.fabricTestStatus||r.fabricTestStatus};
 });
 return {rows:result,matched:matched.size,issues};
}
