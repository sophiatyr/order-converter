import {pricingCode} from './sizeVariants';
import type {OrderData} from '../types/order';
import type {ErpSnapshot} from './erpProducts';
import type {Workspace} from './workspace';
import {productComposition,poComposition} from './orderComposition';
/** Confirmed order edits and maintained product material take priority over ERP. */
export function withErpPiMaterials(order:OrderData,erp:ErpSnapshot|null,workspace?:Workspace):OrderData{
 if(!erp&&!workspace)return order;
 const items=order.items.map(item=>{
  if(item.compositionSource==='manual')return {...item,description:item.composition??item.description};
  const code=pricingCode(item).trim().toUpperCase();
  const maintained=workspace?productComposition(code,workspace,erp):null;
  const product=maintained?.source==='product'?maintained.value:item.compositionSource==='product'&&!maintained?poComposition(item):'';
  if(product)return {...item,description:product,composition:product,compositionSource:'product' as const};
  const specs=[...new Set((erp?.products||[]).filter(p=>p.itemNo.trim().toUpperCase()===code).map(p=>p.chineseSpec.trim()).filter(Boolean))];
  return specs.length===1?{...item,description:specs[0],chineseSpec:/[\u3400-\u9fff]/.test(item.chineseSpec)?item.chineseSpec:specs[0],composition:specs[0],compositionSource:'erp' as const}:item;
 });
 return {...order,items};
}
