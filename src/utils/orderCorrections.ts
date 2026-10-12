import type {OrderData} from '../types/order';
type Field='itemNo'|'unitPriceUSD'|'description';
export function correctOrderItems(order:OrderData,itemIds:string[],values:Partial<Record<Field,string>>,reason:string,date:string){
 if(!reason.trim())throw new Error('請填寫更正原因');
 const corrections=[...(order.corrections||[])];
 const items=order.items.map(item=>{
  if(!itemIds.includes(item.id))return item;let next={...item};
  for(const field of ['itemNo','unitPriceUSD','description'] as const){if(values[field]===undefined)continue;const value=field==='itemNo'?values[field]!.trim().toUpperCase():values[field]!;
   if(field==='itemNo'&&!value)throw new Error('款號不能空白');if(field==='unitPriceUSD'&&(!Number.isFinite(Number(value))||Number(value)<=0))throw new Error('客戶單價須大於 0');
   const original=String(item[field]);if(original===value||(field==='unitPriceUSD'&&Number(original)===Number(value)))continue;
   corrections.push({id:`correction:${date}:${item.id}:${field}:${corrections.length}`,date,itemId:item.id,field,originalValue:original,correctedValue:value,reason:reason.trim()});
   if(field==='itemNo'){next={...next,itemNo:value,factoryProduct:undefined,erpQuoteKey:undefined,chineseName:'',chineseSpec:'',factoryUnitPriceUSD:0,unitPriceRMB:0,totalAmountRMB:0};}
   if(field==='description')next.description=value;
   if(field==='unitPriceUSD')next={...next,unitPriceUSD:Number(value),totalAmountUSD:next.totalQuantity*Number(value),...(next.isPrepack?{kitPriceUSD:Number(value)*(next.piecesPerKit||1)}:{})};
  }
  return next;
 });
 return {...order,items,corrections,totalAmountUSD:items.reduce((n,i)=>n+i.totalQuantity*i.unitPriceUSD,0)};
}
export function applyConfirmedPoCorrections(order:OrderData){
 if(!['26OF028471','26OF028566','26OF028570'].includes(order.poNumber))return order;
 let next=order;
 for(const [from,to] of [['ABCTW070CO','ABCTW070S27'],['ABCTW032W26','ABCTW032S27']]){
  const ids=next.items.filter(i=>i.itemNo===from).map(i=>i.id);
  if(ids.length)next=correctOrderItems(next,ids,{itemNo:to},'客人原始 PO 款號誤植；使用者已確認正確尾碼 S27。','2026-10-09');
 }
 return next;
}
