import type {TrackingRecord} from './workspace';
export interface BulkProgressRow {row:number;po:string;style:string;quantity:number;customerDate:string;fields:Record<string,string>}
export interface BulkProgressSnapshot {source:string;capturedAt:string;rows:BulkProgressRow[]}
export function applyBulkProgress(rows:TrackingRecord[],source:BulkProgressSnapshot){
 const matched=new Set<number>(),issues:{po:string;style:string;reason:string;orderQuantity?:number;sourceQuantity?:number}[]=[];
 const result=rows.map(original=>{
  // Verified against customer PO 26OF036549 v2: 1,902 + 984 sets.
  // Only repair the known old value; preserve later quantity amendments.
  const r=original.poNumber==='26OF036549'&&original.scNumber==='CS26036549'&&original.itemNo==='AFU881S27'&&original.quantity===2866
   ?{...original,quantity:2886,internalFields:{...original.internalFields,P:'2886',_poOriginalTrackingQuantity:'2866',_poQuantityVerified:'26OF036549 v2: 1902 + 984 = 2886'}}:original;
  if(r.season!=='SS27')return r;
  const po=r.poNumber==='26OF043877'?'26OF043875':r.poNumber;
  let candidates=source.rows.filter(s=>s.po===po&&s.style===r.itemNo);
  if(candidates.length>1)candidates=candidates.filter(s=>s.customerDate===r.customerDate);
  if(candidates.length!==1){issues.push({po:r.poNumber,style:r.itemNo,reason:candidates.length?'原始 Bulk Status 有多筆不同進度，待核對':'原始 Bulk Status 未找到相符款式'});return r;}
  const raw=candidates[0];
  // PO 26OF036538 v2, kit composition pp. 2–3: two AFU881 colours
  // contain 1,035 sets each. 3,105 includes 1,035 AFB872 shorts.
  const s=raw.po==='26OF036538'&&raw.style==='AFU881S27'&&raw.quantity===3105
   ?{...raw,quantity:2070,fields:{...raw.fields,_bulkOriginalQuantity:'3105',_poQuantityVerified:'26OF036538 v2: 1035 + 1035 = 2070'}}:raw;
  matched.add(s.row);
  if(s.quantity!==r.quantity)issues.push({po:r.poNumber,style:r.itemNo,reason:'原始 Bulk Status 數量與訂單追蹤不同；保留訂單數量',orderQuantity:r.quantity,sourceQuantity:s.quantity});
  return {...r,bulk:{...r.bulk,...s.fields,_bulkSourceRow:String(s.row),_bulkSourceQuantity:String(s.quantity)},fabricTestDate:s.fields.fabricTestDate||r.fabricTestDate,fabricTestStatus:s.fields.fabricTestStatus==='APPROVED'?'PASS':s.fields.fabricTestStatus||r.fabricTestStatus};
 });
 return {rows:result,matched:matched.size,issues};
}
