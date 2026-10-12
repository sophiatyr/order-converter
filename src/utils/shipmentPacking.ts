import type {Shipment,ShipmentLine} from './workspace';
export interface CartonRow {id:string;from:number;to:number;sizes:Record<string,number>;netWeight:number;grossWeight:number;cbm:number;measurement:string}
export function cartonCount(r:CartonRow){return Math.max(0,r.to-r.from+1);}
export function withCartons(l:ShipmentLine,rows:CartonRow[]):ShipmentLine{
 if(!rows.length)return {...l,packingRows:rows};
 return {...l,packingRows:rows,sizes:Object.fromEntries(Object.keys(l.sizes).map(k=>[k,rows.reduce((n,r)=>n+(r.sizes[k]||0)*cartonCount(r),0)])),cartons:rows.reduce((n,r)=>n+cartonCount(r),0),netWeight:rows.reduce((n,r)=>n+r.netWeight*cartonCount(r),0),grossWeight:rows.reduce((n,r)=>n+r.grossWeight*cartonCount(r),0),cbm:rows.reduce((n,r)=>n+r.cbm*cartonCount(r),0)};
}
export function packingIssues(s:Shipment){
 const issues:string[]=[];
 const ranges:{from:number;to:number}[]=[];
 for(const l of s.lines.filter(l=>Object.values(l.sizes).some(q=>q>0))){
  if(!l.packingRows?.length){issues.push(`${l.itemNo} / ${l.color}：請填逐箱裝箱明細`);continue;}
  for(const r of l.packingRows){
   if(!Number.isInteger(r.from)||!Number.isInteger(r.to)||r.from<1||r.to<r.from)issues.push(`${l.itemNo}：箱號範圍不正確`);
   if(ranges.some(a=>r.from<=a.to&&r.to>=a.from))issues.push(`${l.itemNo}：箱號重複`);ranges.push(r);
   if(Object.values(r.sizes).some(q=>!Number.isInteger(q)||q<0)||!Object.values(r.sizes).some(q=>q>0)||Object.keys(r.sizes).some(k=>!(k in l.sizes)))issues.push(`${l.itemNo}：每箱尺碼數量不正確`);
   if(!Number.isFinite(r.netWeight)||r.netWeight<=0||!Number.isFinite(r.grossWeight)||r.grossWeight<r.netWeight||!Number.isFinite(r.cbm)||r.cbm<=0)issues.push(`${l.itemNo}：請核對每箱重量及材積`);
  }
  const expected=withCartons(l,l.packingRows);
  if(Object.keys(l.sizes).some(k=>l.sizes[k]!==expected.sizes[k])||['cartons','netWeight','grossWeight','cbm'].some(k=>Math.abs(Number(l[k as keyof ShipmentLine])-Number(expected[k as keyof ShipmentLine]))>0.000001))issues.push(`${l.itemNo}：逐箱明細與款色合計不一致`);
 }
 return [...new Set(issues)];
}
