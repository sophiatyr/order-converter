import {pricingCode} from './sizeVariants';
import type {Workspace,ProductPrice} from './workspace';
import type {ErpSnapshot,ErpQuote} from './erpProducts';
import {productQuotes} from './erpProducts';
import {localToday} from './trackingAutomation';
export function priceDate(value:string){return /^\d{8}$/.test(value)?`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6)}`:value;}
export function productPriceHistory(style:string,w:Workspace,erp:ErpSnapshot|null):ProductPrice[]{
 const product=erp?.products.find(p=>p.itemNo===style),note=w.productNotes[style];
 const records:ProductPrice[]=[...(note?.prices||[]),...(product?.purchasePrices||[])];
 if(product)for(const q of productQuotes(product))if(q.factoryPrice!==null)records.push({id:'erp-quote:'+JSON.stringify(q),kind:'factory',party:q.supplierCode,partyName:q.factorySupplier,date:priceDate(q.quoteDate),currency:q.factoryCurrency,price:q.factoryPrice,unit:q.purchaseUom,remarks:'',createdAt:'',source:'ERP 工廠報價'});
 for(const [i,t] of (product?.transactions||[]).entries())records.push({id:`erp-${t.kind}:${t.document}:${i}`,kind:'customer',party:t.company||'CSQ（下單公司未確認）',date:priceDate(t.date),currency:t.currency,price:t.price,unit:t.unit,remarks:t.kind==='order'?'下單成交價':'出貨成交價',createdAt:'',source:t.kind==='order'?'ERP 下單':'ERP 出貨',document:t.document});
 for(const order of w.orders)for(const item of order.items)if(pricingCode(item)===style){
  records.push(...(item.factoryPriceHistory||[]));
  const alreadyInErp=product?.transactions?.some(t=>t.kind==='order'&&t.scNumber===order.piNumber&&t.price===item.unitPriceUSD&&t.quantity===item.totalQuantity);
  if(!alreadyInErp)records.push({id:`local-order:${order.poNumber}:${item.id}`,kind:'customer',party:order.orderingCompany||order.customerName,date:priceDate(order.poDate),currency:'USD',price:item.unitPriceUSD,unit:'PC',remarks:'當張訂單成交價',createdAt:'',source:'工作站訂單',document:order.piNumber});
  if(item.factoryProduct){const q=item.factoryProduct;records.push({id:`local-factory:${order.poNumber}:${item.id}`,kind:'factory',party:q.supplierCode,partyName:q.supplier,date:priceDate(q.quoteDate),currency:q.currency,price:q.price,unit:q.unit==='套'?'SET':q.unit==='雙'?'PR':'PC',remarks:'當張訂單採購價',createdAt:'',source:'工作站訂單',document:order.piNumber});}
 }
 // Legacy scalar prices have no known effective date; never invent one.
 if(note?.customerPrice!==undefined)records.push({id:'legacy-customer',kind:'customer',party:'客戶（舊資料未記錄公司）',date:'',currency:note.customerCurrency||'USD',price:note.customerPrice,unit:'',remarks:'日期／公司／單位待補；請新增完整報價',createdAt:'',source:'舊版手動價格'});
 if(note?.factoryPrice!==undefined)records.push({id:'legacy-factory',kind:'factory',party:note.supplierCode||'工廠待補',date:'',currency:note.factoryCurrency||'',price:note.factoryPrice,unit:'',remarks:'日期／單位待補；請新增完整報價',createdAt:'',source:'舊版手動價格'});
 return [...new Map(records.map(q=>[q.id,q])).values()].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
}
export function withProductFactoryQuotes(erp:ErpSnapshot,w:Workspace):ErpSnapshot{
 const products=new Map(erp.products.map(p=>[p.itemNo,{...p}]));
 for(const [style,note] of Object.entries(w.productNotes)){
  const p=products.get(style)||{itemNo:style,chineseName:note.name||'',chineseSpec:note.spec||'',supplierCode:'',factorySupplier:'',factoryCurrency:'',factoryPrice:null,uom:'PC',issue:'',quoteDate:''};
  const manual=(note.prices||[]).filter(q=>q.kind==='factory'&&!note.withdrawnPrices?.[q.id]&&q.date<=localToday()).map(q=>({supplierCode:q.party,factorySupplier:q.partyName||q.party,factoryCurrency:q.currency,factoryPrice:q.price,purchaseUom:q.unit,quoteDate:q.date}));
  const quotes=[...productQuotes(p),...manual];products.set(style,{...p,quotes,...(quotes.length>1?{issue:'同款有多筆工廠報價，請選擇此訂單使用的報價'}:{})});
 }
 return {...erp,products:[...products.values()]};
}
export function factoryQuoteForPrice(q:ProductPrice):ErpQuote{return {supplierCode:q.party,factorySupplier:q.partyName||q.party,factoryCurrency:q.currency==='US$'?'USD':q.currency,factoryPrice:q.price,purchaseUom:q.unit,quoteDate:q.date};}
