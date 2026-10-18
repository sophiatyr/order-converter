import type {OrderData} from '../types/order';
export interface CompositionReference {poNumber:string;date:string;fileName:string;quantity:number;amount:number;items:{itemNo:string;description:string;composition:string;quantity:number;colors:{code:string;quantity:number}[]}[]}
export async function loadCompositionReferences():Promise<CompositionReference[]>{try{const r=await fetch(`${import.meta.env.BASE_URL}csq-composition-references.json`,{cache:'no-store'});if(!r.ok)return [];const value=await r.json();return Array.isArray(value)?value:[];}catch{return [];}}
export function repairMedicoComposition(order:OrderData,refs:CompositionReference[]):OrderData{
 if(order.orderingCompany!=='MEDICO')return order;
 let candidates=refs.filter(r=>r.poNumber===order.poNumber&&r.date===order.poDate&&r.quantity===(order.sourcePrintedQuantity??order.totalPieces)&&Math.abs(r.amount-(order.sourcePrintedAmount??order.totalAmountUSD))<.01);
 const filename=order.sourceFileName?.split(/[\\/]/).pop();
 if(filename){const matched=candidates.filter(r=>r.fileName===filename);if(matched.length)candidates=matched;else return order;}
 if(!candidates.length)return order;
 let changed=false;
 const items=order.items.map(item=>{
  if(item.composition!==undefined||order.corrections?.some(c=>c.itemId===item.id&&c.field==='description'))return item;
  const matches=candidates.flatMap(r=>r.items.filter(i=>i.itemNo===item.itemNo&&i.colors.some(c=>item.colors.some(color=>color.colorCode===c.code))));
  const compositions=[...new Set(matches.map(i=>i.composition).filter(Boolean))];
  if(compositions.length!==1||!matches.some(i=>item.description===i.description||item.description===''))return item;
  changed=true;return {...item,composition:compositions[0],description:compositions[0]};
 });
 return changed?{...order,items}:order;
}
