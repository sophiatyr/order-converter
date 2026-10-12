import type { OrderData } from '../types/order';
import {chineseFactoryName} from './csqAccount';
export interface ErpQuote {
  supplierCode:string; factorySupplier:string; factoryCurrency:string;
  factoryPrice:number|null; purchaseUom:string; quoteDate:string;
}
export interface ErpProduct {
  itemNo:string; chineseName:string; chineseSpec:string; supplierCode:string;
  factorySupplier:string; factoryCurrency:string; factoryPrice:number|null;
  uom:string; purchaseUom?:string; issue:string; quoteDate:string;
  quotes?: ErpQuote[];
}
export interface ErpSnapshot {account:'CSQ'; updatedAt:string; products:ErpProduct[]}
// User confirmed: one ABCRA07 PO quantity means one pair of gloves.
export const PO_PAIR_ITEMS=['ABCRA07'];
export function erpQuoteKey(q: ErpQuote): string {
  return JSON.stringify([q.supplierCode,q.factorySupplier,q.factoryCurrency,q.factoryPrice,q.purchaseUom,q.quoteDate]);
}
export function productQuotes(product: ErpProduct): ErpQuote[] {
  const quotes = product.quotes || (product.factorySupplier && product.supplierCode ? [{supplierCode:product.supplierCode,factorySupplier:product.factorySupplier,factoryCurrency:product.factoryCurrency,factoryPrice:product.factoryPrice,purchaseUom:product.purchaseUom || product.uom,quoteDate:product.quoteDate}] : []);
  return [...new Map(quotes.map(q=>[erpQuoteKey(q),q])).values()];
}
export function applyErpProducts(order:OrderData,snapshot:ErpSnapshot, choices:Record<string,string> = {}){
  if(snapshot.account!=='CSQ'||!Array.isArray(snapshot.products))throw new Error('ERP 產品檔格式不符。');
  const issues:string[]=[];let matched=0;
  const items=order.items.map(item=>{
    const found=snapshot.products.filter(p=>p.itemNo.trim().toUpperCase()===item.itemNo.trim().toUpperCase());
    if(found.length!==1){issues.push(`${item.itemNo}：${found.length?'ERP 品號重複':'ERP 查無產品'}，此款暫不列入採購單。`);return {...item,factoryProduct:undefined};}
    const master=found[0], style=item.itemNo.trim().toUpperCase();
    const selectedKey=Object.prototype.hasOwnProperty.call(choices,style)?choices[style]:item.erpQuoteKey;
    const selected=selectedKey?productQuotes(master).find(q=>erpQuoteKey(q)===selectedKey):undefined;
    const p=selected?{...master,...selected,issue:''}:master;
    const uom=(p.purchaseUom||p.uom).toUpperCase();
    const pair=PO_PAIR_ITEMS.includes(item.itemNo.toUpperCase())&&uom==='PR'&&p.uom.toUpperCase()==='PR';
    const unitIssue=p.issue==='產品供應商報價單位與 PO 件數尚未確認換算'&&pair;
    const next={...item,erpQuoteKey:selected?selectedKey:undefined,chineseName:p.chineseName||item.chineseName,chineseSpec:p.chineseSpec||item.chineseSpec};
    if(selectedKey&&!selected){issues.push(`${item.itemNo}：原先選擇的報價已不存在，請重新選擇工廠報價。`);return {...next,factoryProduct:undefined};}
    if((p.issue&&!unitIssue)||!p.factorySupplier||!p.supplierCode||(!pair&&(!['PC','PCS','PZ'].includes(uom)||!['PC','PCS','PZ'].includes(p.uom.toUpperCase())))||!['USD','RMB','CNY'].includes(p.factoryCurrency)||!Number.isFinite(p.factoryPrice)||!(p.factoryPrice!>0)){
      issues.push(`${item.itemNo}：${p.issue||'ERP 工廠、幣別、單位或成本待確認'}；保留品名與規格，此款暫不列入採購單。`);
      return {...next,factoryProduct:undefined};
    }
    matched++;
    const currency=(p.factoryCurrency==='USD'?'USD':'RMB') as 'USD'|'RMB';
    return {...next,factoryUnitPriceUSD:currency==='USD'?p.factoryPrice!:0,unitPriceRMB:currency==='RMB'?p.factoryPrice!:0,totalAmountRMB:currency==='RMB'?item.totalQuantity*p.factoryPrice!:0,
      factoryProduct:{supplier:p.factorySupplier,supplierCode:p.supplierCode,currency,price:p.factoryPrice!,unit:pair?'雙':'件',quoteDate:p.quoteDate}};
  });
  const next={...order,items,erpFactoryApplied:true};
  const documents=erpFactoryOrders(next);
  if(documents.length===1&&matched===items.length)Object.assign(next,{factorySupplier:documents[0].order.factorySupplier,supplierCode:documents[0].order.supplierCode,factoryCurrency:documents[0].order.factoryCurrency});
  if(documents.length>1)issues.push(`已依工廠與幣別分成 ${documents.length} 張採購單，請選擇預覽及匯出。`);
  return {order:next,issues:[...new Set(issues)],matched};
}
export function erpFactoryOrders(order:OrderData){
  const groups=new Map<string,typeof order.items>();
  for(const item of order.items){const p=item.factoryProduct;if(!p)continue;const key=`${p.supplierCode}|${p.supplier}|${p.currency}|${p.unit}`;groups.set(key,[...(groups.get(key)||[]),item]);}
  return [...groups].map(([id,items])=>{
    const p=items[0].factoryProduct!;
    const options=order.factoryPurchaseOptions?.[id];
    return {id,label:`${p.supplierCode} · ${options?.chineseName||chineseFactoryName(p.supplier)} · ${p.currency}`,order:{...order,items,factoryExtraFees:options?.extraFees||[],hasDeposit:options?.hasDeposit??order.hasDeposit,depositPercent:options?.depositPercent??order.depositPercent,factoryQuantityUnit:(p.unit==='雙'?'雙':'件') as '件'|'雙',factorySupplier:options?.chineseName||p.supplier,supplierCode:p.supplierCode,factoryCurrency:p.currency,totalPieces:items.reduce((s,i)=>s+i.totalQuantity,0),totalAmountUSD:items.reduce((s,i)=>s+i.totalQuantity*(i.factoryUnitPriceUSD||0),0),totalAmountRMB:items.reduce((s,i)=>s+i.totalQuantity*i.unitPriceRMB,0)}};
  });
}
export async function loadErpProducts():Promise<ErpSnapshot>{const response=await fetch(`${import.meta.env.BASE_URL}erp-products.json`,{cache:'no-store'});if(!response.ok)throw new Error('尚無 ERP 產品快照。請先雙擊「更新ERP產品資料.bat」，再帶入。');return response.json();}
