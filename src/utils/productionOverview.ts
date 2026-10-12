import type {TrackingRecord} from './workspace';
import {bulkPhases} from './trackingFields';
export function productionGroups(rows:TrackingRecord[]){
 const groups=new Map<string,TrackingRecord[]>();
 for(const r of rows){const key=[r.season,r.brand,r.series,r.itemNo].join('|');groups.set(key,[...(groups.get(key)||[]),r]);}
 return [...groups.values()].map(records=>({key:[records[0].season,records[0].brand,records[0].series,records[0].itemNo].join('|'),record:records[0],records,waiting:bulkPhases.filter(([k])=>records.some(r=>r.bulk?.[k+'Status']==='WAITING CISALFA')).map(([k]):string=>k)}));
}
export function stageSummary(rows:TrackingRecord[],key:string){
 const statuses=rows.map(r=>r.bulk?.[key+'Status']||''),unique=[...new Set(statuses)];
 return {status:unique.length===1?unique[0]:'MIXED',complete:statuses.filter(s=>['APPROVED','RECEIVED','COMPLETED','SHIPPED','NOT REQUIRED'].includes(s)).length,total:rows.length,waiting:statuses.filter(s=>s==='WAITING CISALFA').length};
}
