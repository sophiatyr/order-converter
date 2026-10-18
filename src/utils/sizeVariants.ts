import type {OrderData,OrderItem} from '../types/order';
/** Confirmed ERP size variants; retain the customer's base style and row IDs. */
export const pricingCode=(item:OrderItem)=>item.erpItemNo||item.itemNo;
export function sizeVariantOrder(order:OrderData):OrderData{
 return {...order,items:order.items.map(item=>{
  if(item.itemNo.trim().toUpperCase()!=='RCL006')return item;
  const active=item.sizes.filter(size=>item.colors.some(c=>(c.quantitiesBySize[size]||0)>0));
  if(active.length!==1||!['S','M','L','XL'].includes(active[0]))return item.erpItemNo?{...item,erpItemNo:undefined,factoryProduct:undefined,erpQuoteKey:undefined,factoryPriceRecord:undefined,factoryUnitPriceUSD:undefined,unitPriceRMB:0,totalAmountRMB:0}:item;
  const erpItemNo=`RCL006-${active[0]}`;
  if(item.erpItemNo===erpItemNo)return item;
  return {...item,erpItemNo,factoryProduct:undefined,erpQuoteKey:undefined,factoryPriceRecord:undefined,factoryUnitPriceUSD:undefined,unitPriceRMB:0,totalAmountRMB:0};
 })};
}
export const sizeLabel=(size:string)=>({S:'28-34(S)',M:'35-38(M)',L:'39-42(L)',XL:'43-46(XL)'}[size]||size);
