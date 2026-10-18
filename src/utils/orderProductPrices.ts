import {pricingCode} from './sizeVariants';
import type {OrderData} from '../types/order';
import type {Workspace,ProductPrice} from './workspace';
import type {ErpSnapshot} from './erpProducts';
import {applyErpProducts,erpQuoteKey} from './erpProducts';
import {productPriceHistory,factoryQuoteForPrice} from './productPriceHistory';
import {correctOrderItems} from './orderCorrections';
import {localToday} from './trackingAutomation';
export function applyProductPrice(order:OrderData,style:string,id:string,w:Workspace,erp:ErpSnapshot|null):OrderData{
 const q=productPriceHistory(style,w,erp).find(q=>q.id===id);
 if(!q||w.productNotes[style]?.withdrawnPrices?.[q.id])throw Error('報價不存在或已作廢，請重新選擇。');
 if(!q.date||q.date>localToday())throw Error('報價日期待補或尚未生效，不能直接套用。');
 const ids=order.items.filter(i=>pricingCode(i)===style).map(i=>i.id);if(!ids.length)throw Error('訂單沒有此款式。');
 if(q.kind==='customer'){
  if(q.currency!=='USD'||!['PC','PCS','PZ'].includes(q.unit.toUpperCase()))throw Error('客戶文件目前使用 USD／件；不同幣別或單位須先核對換算，不能直接套用。');
  const next=correctOrderItems(order,ids,{unitPriceUSD:String(q.price)},`選用客戶價格：${q.party} ${q.date}（${q.source||'報價'}）`,localToday());
  return {...next,items:next.items.map(i=>ids.includes(i.id)?{...i,customerPriceRecord:{...q}}:i)};
 }
 const quote=factoryQuoteForPrice(q),original=erp?.products.find(p=>p.itemNo===style);
 const product={itemNo:style,chineseName:original?.chineseName||w.productNotes[style]?.name||'',chineseSpec:original?.chineseSpec||w.productNotes[style]?.spec||'',supplierCode:q.party,factorySupplier:q.partyName||q.party,factoryCurrency:quote.factoryCurrency,factoryPrice:q.price,uom:original?.uom||'PC',purchaseUom:q.unit,issue:'',quoteDate:q.date,quotes:[quote]};
 const result=applyErpProducts(order,{account:'CSQ',updatedAt:new Date().toISOString(),products:[...(erp?.products||[]).filter(p=>p.itemNo!==style),product]},{[style]:erpQuoteKey(quote)});
 if(result.order.items.some(i=>pricingCode(i)===style&&!i.factoryProduct))throw Error(result.issues.join('；')||'工廠報價的幣別、單位或價格尚未確認。');
 return {...order,erpFactoryApplied:true,items:result.order.items.map(i=>pricingCode(i)===style?{...i,factoryPriceRecord:{...q}}:order.items.find(prior=>prior.id===i.id)!)};
}
