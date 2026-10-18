import type {OrderData,OrderItem} from '../types/order';
import type {Workspace} from './workspace';
import type {ErpSnapshot} from './erpProducts';
const comparable=(v:string)=>v.replace(/\s+/g,' ').trim().toUpperCase();
export function productComposition(style:string,w:Workspace,erp:ErpSnapshot|null):{value:string;source:'product'|'erp'}|null{
 const code=style.trim().toUpperCase(),note=w.productNotes[code];
 if(note?.createdFromPo){const specs=[...new Set((erp?.products||[]).filter(p=>p.itemNo.trim().toUpperCase()===code).map(p=>p.chineseSpec.trim()).filter(Boolean))];if(specs.length===1)return {value:specs[0],source:'erp'};}
 if(note?.spec?.trim())return {value:note.spec.trim(),source:'product'};
 const mapped=[...new Set((w.productMappings||[]).filter(p=>p.itemNo.trim().toUpperCase()===code).map(p=>p.chineseSpec.trim()).filter(Boolean))];
 if(mapped.length===1)return {value:mapped[0],source:'product'};
 const values=[...new Set((erp?.products||[]).filter(p=>p.itemNo.trim().toUpperCase()===code).map(p=>p.chineseSpec.trim()).filter(Boolean))];
 return values.length===1?{value:values[0],source:'erp'}:null;
}
export function poComposition(item:OrderItem):string{
 if(item.composition?.trim())return item.composition;
 const labeled=(item.description||'').match(/Products\s+composition:\s*([\s\S]+)/i);
 if(labeled)return labeled[1].trim();
 // Older imports stored fabric in description; garment names are excluded.
 return item.description!==item.styleName&&/(\d\s*%|POLYESTER|NYLON|COTTON|SPANDEX|VISCOSE|面料|成分)/i.test(item.description)?item.description.trim():'';
}
export function enrichOrderComposition(order:OrderData,w:Workspace,erp:ErpSnapshot|null):OrderData{
 let changed=false;
 const items=order.items.map(item=>{
  const existing=poComposition(item);
  if(existing){if(item.composition===existing&&item.compositionSource)return item;changed=true;return {...item,composition:existing,compositionSource:item.compositionSource||'po' as const};}
  const fallback=productComposition(item.itemNo,w,erp);if(!fallback)return item;
  changed=true;return {...item,composition:fallback.value,description:fallback.value,compositionSource:fallback.source};
 });
 return changed?{...order,items}:order;
}
export function compositionDifference(item:OrderItem,w:Workspace,erp:ErpSnapshot|null){const chosen=poComposition(item),product=productComposition(item.itemNo,w,erp);return chosen&&product&&comparable(chosen)!==comparable(product.value)?product:null;}
export const compositionSourceLabels={po:'原始 PO',manual:'手動核對',product:'產品資料',erp:'ERP 產品資料'};
