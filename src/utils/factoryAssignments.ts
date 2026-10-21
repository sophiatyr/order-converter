import {pricingCode} from './sizeVariants';
import type {OrderData} from '../types/order';
import type {ProductPrice} from './workspace';
import {localToday} from './trackingAutomation';
import {erpFactoryOrders} from './erpProducts';
import {newId} from './uid';
export interface FactoryAssignment {supplierCode:string;supplier:string;currency:'USD'|'RMB';price:string;date:string;unit:'件'|'雙'|'套'}
export function assignStyleFactories(order:OrderData,drafts:Record<string,FactoryAssignment>):OrderData{
 for(const [style,d] of Object.entries(drafts)){
  if(!order.items.some(i=>pricingCode(i)===style))throw Error(`${style} 不在此訂單。`);
  if(!d.supplierCode.trim()||!d.supplier.trim()||!['USD','RMB'].includes(d.currency)||!['件','雙','套'].includes(d.unit)||!Number.isFinite(Number(d.price))||Number(d.price)<=0)throw Error(`${style}：請填妥工廠代號、名稱、幣別及有效單價。`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||d.date>localToday())throw Error(`${style}：請填寫已生效的價格日期。`);
 }
 const createdAt=new Date().toISOString();
 const records=Object.fromEntries(Object.entries(drafts).map(([style,d])=>[style,{id:newId(),kind:'factory',party:d.supplierCode.trim().toUpperCase(),partyName:d.supplier.trim(),currency:d.currency,price:Number(d.price),unit:d.unit==='套'?'SET':d.unit==='雙'?'PR':'PC',date:d.date,createdAt,document:order.piNumber,source:'工作站採購設定',remarks:'此訂單同款各色共用採購單價'} satisfies ProductPrice]));
 const items=order.items.map(item=>{
  const d=drafts[pricingCode(item)],q=records[pricingCode(item)];if(!d)return item;
  const p=item.factoryProduct,previous=item.factoryPriceRecord||(p?{id:`prior:${order.poNumber}:${item.id}:${p.quoteDate}:${p.supplierCode}:${p.price}`,kind:'factory' as const,party:p.supplierCode,partyName:p.supplier,currency:p.currency,price:p.price,unit:p.unit==='套'?'SET':p.unit==='雙'?'PR':'PC',date:p.quoteDate.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'),createdAt:'',document:order.piNumber,source:'工作站歷次採購設定',remarks:''}:undefined);
  const history=[...new Map([...(item.factoryPriceHistory||[]),...(previous?[previous]:[]),q].map(record=>[record.id,record])).values()];
  return {...item,erpQuoteKey:undefined,factoryPriceRecord:q,factoryPriceHistory:history,factoryProduct:{supplier:q.partyName!,supplierCode:q.party,currency:d.currency,price:q.price,unit:d.unit,quoteDate:d.date},factoryUnitPriceUSD:d.currency==='USD'?q.price:0,unitPriceRMB:d.currency==='RMB'?q.price:0,totalAmountRMB:d.currency==='RMB'?q.price*item.totalQuantity:0};
 });
 const next={...order,items,erpFactoryApplied:true},groups=erpFactoryOrders(next);
 return {...next,totalAmountRMB:items.reduce((sum,i)=>sum+i.totalAmountRMB,0),...(groups.length===1?{factorySupplier:groups[0].order.factorySupplier,supplierCode:groups[0].order.supplierCode,factoryCurrency:groups[0].order.factoryCurrency}:{factorySupplier:'',supplierCode:'',factoryCurrency:undefined})};
}
