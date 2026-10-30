import type {Shipment} from './workspace';
import type {OrderData} from '../types/order';
function actualKey(s:Shipment){return JSON.stringify([s.factoryNotice?.plannedSelection||'',s.lines.map(l=>[l.id,l.itemNo,l.color,Object.entries(l.sizes).sort(([a],[b])=>a.localeCompare(b))]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))]);}
export function shipmentSelectionIssues(s:Shipment,allowVariance=false){
 if(!s.factoryNotice?.plannedSelection)return [];
 try{
  const selected=JSON.parse(s.factoryNotice.plannedSelection),issues:string[]=[],reviewed=s.factoryNotice?.quantityVarianceActual===actualKey(s);
  if(!selected||typeof selected!=='object'||Array.isArray(selected))throw Error();
  for(const l of s.lines){const sizes=selected[l.id];if(!sizes||typeof sizes!=='object'||Array.isArray(sizes)||Object.values(sizes).some(q=>typeof q!=='number'||!Number.isInteger(q)||q<0)){issues.push(`${l.itemNo}：本次選取數量無效`);continue;}for(const [size,q] of Object.entries(l.sizes))if(q>(sizes[size]||0)&&!allowVariance&&!reviewed)issues.push(`${l.itemNo} / ${l.color} / ${size}：實際裝箱超過本次選取量，請核對實際差異`);}
  return issues;
 }catch{return ['本次出貨款色選取資料格式不符'];}
}
export function shipmentQuantityDifferences(s:Shipment,all:Shipment[],order?:OrderData){
 const selection=JSON.parse(s.factoryNotice?.plannedSelection||'{}') as Record<string,Record<string,number>>;
 return s.lines.flatMap(l=>{
  const colors=order?.items.filter(i=>i.itemNo===l.itemNo).flatMap(i=>i.colors).filter(c=>`${c.colorCode} ${c.colorName}`.trim()===l.color.trim());
  const prior=all.filter(x=>x.id!==s.id&&x.confirmed&&x.poNumber===s.poNumber&&x.scNumber===s.scNumber).flatMap(x=>x.lines).filter(x=>x.itemNo===l.itemNo&&x.color===l.color);
  return [...new Set([...Object.keys(l.sizes),...Object.keys(selection[l.id]||{})])].sort().flatMap(size=>{
   const actual=l.sizes[size]||0,previous=prior.reduce((n,x)=>n+(x.sizes[size]||0),0),po=colors?.length&&colors.every(c=>!!c.quantitiesBySize)?colors.reduce((n,c)=>n+(c.quantitiesBySize[size]||0),0):null,planned=selection[l.id]?.[size]??(po===null?null:Math.max(0,po-previous)),delta=planned===null?null:actual-planned;
   return delta!==null&&delta!==0||po!==null&&previous+actual>po?[{lineId:l.id,po:s.poNumber,style:l.itemNo,color:l.color,size,ordered:po,previous,planned,actual,delta,excess:po===null?0:Math.max(0,previous+actual-po)}]:[];
  });
 });
}
function contextKey(s:Shipment,all:Shipment[],order?:OrderData){return JSON.stringify([actualKey(s),shipmentQuantityDifferences(s,all,order)]);}
export function quantityVarianceReviewed(s:Shipment,all:Shipment[],order?:OrderData){return s.factoryNotice?.quantityVarianceContext===contextKey(s,all,order)&&s.factoryNotice?.quantityVarianceActual===actualKey(s);}
export function reviewShipmentQuantityVariance(s:Shipment,all:Shipment[],order?:OrderData):Shipment{
 if(s.confirmed)throw Error('已確認出貨不可修改實際差異核對。');
 const invalid=shipmentSelectionIssues(s,true);if(invalid.length)throw Error(invalid.join('；'));
 return {...s,factoryNotice:{...s.factoryNotice,quantityVarianceActual:actualKey(s),quantityVarianceContext:contextKey(s,all,order)}};
}


