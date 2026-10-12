import type {TrackingRecord} from './workspace';
import {internalValues} from './trackingDocuments';
export function orderFinancials(rows:TrackingRecord[]){
 const orders=new Map<string,TrackingRecord[]>();
 for(const r of rows){const key=JSON.stringify([r.scNumber,r.poNumber]);orders.set(key,[...(orders.get(key)||[]),r]);}
 return [...orders.values()].map(records=>{
  const sales=new Map<string,number>(),costs=new Map<string,{supplier:string;currency:string;amount:number;usd:number|null}>();let missingSales=false,missingCosts=false;
  for(const r of records){const f=internalValues(r),saleKey=f._scopeH||r.scNumber,costKey=f._scopeL||`${r.scNumber}:${r.supplier}`;
   if(f.H!==''&&Number.isFinite(Number(f.H)))sales.set(saleKey,Number(f.H));else missingSales=true;
   if(f.L!==''&&Number.isFinite(Number(f.L)))costs.set(costKey,{supplier:f.K||r.supplier,currency:f._costCurrency||'幣別待核對',amount:Number(f.L),usd:f.M!==''&&Number.isFinite(Number(f.M))?Number(f.M):null});else missingCosts=true;
  }
  const salesAmount=missingSales||!sales.size?null:[...sales.values()].reduce((n,v)=>n+v,0);
  const usdCost=missingCosts||!costs.size||[...costs.values()].some(v=>v.usd===null)?null:[...costs.values()].reduce((n,v)=>n+v.usd!,0);
  return {key:JSON.stringify([records[0].scNumber,records[0].poNumber]),record:records[0],records,quantity:records.reduce((n,r)=>n+r.quantity,0),salesAmount,costs:[...costs.values()],usdCost,margin:salesAmount!==null&&salesAmount>0&&usdCost!==null?(salesAmount-usdCost)/salesAmount:null};
 });
}
