import type {Shipment} from './workspace';
export function shipmentSelectionIssues(s:Shipment){
 if(!s.factoryNotice?.plannedSelection)return [];
 try{
  const selected=JSON.parse(s.factoryNotice.plannedSelection),issues:string[]=[];
  if(!selected||typeof selected!=='object'||Array.isArray(selected))throw Error();
  for(const l of s.lines){const sizes=selected[l.id];if(!sizes||typeof sizes!=='object'||Array.isArray(sizes)||Object.values(sizes).some(q=>typeof q!=='number'||!Number.isInteger(q)||q<0)){issues.push(`${l.itemNo}：本次選取數量無效`);continue;}for(const [size,q] of Object.entries(l.sizes))if(q>(sizes[size]||0))issues.push(`${l.itemNo} / ${l.color} / ${size}：實際裝箱超過本次選取量`);}
  return issues;
 }catch{return ['本次出貨款色選取資料格式不符'];}
}
