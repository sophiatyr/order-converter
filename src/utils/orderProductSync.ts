import {pricingCode} from './sizeVariants';
import type {OrderData} from '../types/order';
import type {Workspace} from './workspace';
import type {ErpSnapshot} from './erpProducts';
import {brandOf,seasonOf} from './workspace';
import {poComposition} from './orderComposition';
/** Create missing product masters once; order records remain the price ledger. */
export function syncOrderProducts(w:Workspace,order:OrderData,erp:ErpSnapshot|null):Workspace{
 const known=new Set([...(erp?.products||[]).map(p=>p.itemNo.trim().toUpperCase()),...(w.productMappings||[]).map(p=>p.itemNo.trim().toUpperCase()),...Object.keys(w.productNotes).map(code=>code.trim().toUpperCase())]);
 const productNotes={...w.productNotes};let changed=false;
 for(const item of order.items){
  const code=pricingCode(item).trim().toUpperCase();if(!code||known.has(code)||['__PROTO__','CONSTRUCTOR','PROTOTYPE'].includes(code))continue;
  known.add(code);changed=true;
  productNotes[code]={brand:order.brand||(brandOf(item.styleName)!==item.styleName.trim()?brandOf(item.styleName):''),series:order.series||'',season:order.season||seasonOf(code),name:item.styleName,spec:poComposition(item),remarks:'',createdFromPo:order.poNumber};
 }
 return changed?{...w,productNotes}:w;
}
