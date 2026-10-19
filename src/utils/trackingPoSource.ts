import type {OrderData} from '../types/order';
import type {ShipmentLine} from './workspace';
// The internal sock tracker uses RCL006-S etc.; the original PO has one
// RCL006 style and its S/M/L/XL quantity columns. Resolve only literal sizes.
export function poStyleItems(order:OrderData|undefined,sku:string){
 const exact=order?.items.filter(i=>i.itemNo===sku)||[];if(exact.length)return exact;
 const variant=sku.match(/^(.+)-(XS|S|M|L|XL|XXL|XXXL)$/);if(!variant)return [];
 return (order?.items||[]).filter(i=>i.itemNo===variant[1]&&i.sizes.includes(variant[2])).map(i=>{
  const size=variant[2],colors=i.colors.map(c=>({...c,totalQuantity:c.quantitiesBySize[size]||0,quantitiesBySize:{[size]:c.quantitiesBySize[size]||0}})).filter(c=>c.totalQuantity>0),totalQuantity=colors.reduce((n,c)=>n+c.totalQuantity,0);
  return {...i,itemNo:sku,sizes:[size],colors,totalQuantity,totalAmountUSD:totalQuantity*i.unitPriceUSD};
 }).filter(i=>i.totalQuantity>0);
}

export function shipmentStyleQuantity(line:ShipmentLine,sku:string,order?:OrderData){
 if(line.itemNo===sku)return Object.values(line.sizes).reduce((n,q)=>n+q,0);
 const variant=sku.match(/^(.+)-(XS|S|M|L|XL|XXL|XXXL)$/);
 if(variant&&line.itemNo===variant[1]&&poStyleItems(order,sku).length)return line.sizes[variant[2]]||0;
 return 0;
}
