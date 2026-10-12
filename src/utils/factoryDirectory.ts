import type {ErpSnapshot} from './erpProducts';
import type {TrackingRecord} from './workspace';
const key=(value:string)=>value.toUpperCase().replace(/[\s.,，。()（）&\-_/]/g,'');
const chinese=(value:string)=>value.match(/[\u3400-\u9fff][^A-Za-z\r\n]*/)?.[0].trim()||'';
export function factoryDirectory(erp:ErpSnapshot|null|undefined){
 const names=new Map<string,string>(),candidates=new Map<string,Set<string>>();
 const add=(alias:string,code:string)=>{if(!alias.trim())return;const k=key(alias);candidates.set(k,new Set([...(candidates.get(k)||[]),code]));};
 for(const p of erp?.products||[])for(const quote of [p,...(p.quotes||[])]){
  const code=quote.supplierCode?.trim().toUpperCase(),name=quote.factorySupplier?.trim();if(!code||!name)continue;
  names.set(code,chinese(name)||name);add(code,code);add(name,code);add(chinese(name),code);
  const english=name.match(/[A-Za-z][A-Za-z\s().,&-]+$/)?.[0];if(english)add(english,code);
 }
 // The user confirmed that these short names refer to ERP supplier LA.
 if(names.has('LA'))for(const alias of ['雷諾斯','雷诺斯'])add(alias,'LA');
 const aliases=new Map([...candidates].filter(([,codes])=>codes.size===1).map(([alias,codes])=>[alias,[...codes][0]]));
 return {names,resolve:(...values:string[])=>{for(const value of values){const code=aliases.get(key(value));if(code)return {code,name:names.get(code)!};}return null;}};
}
export function normalizeTrackingFactories(rows:TrackingRecord[],erp:ErpSnapshot|null|undefined){
 const directory=factoryDirectory(erp);
 return rows.map(r=>{if(r.supplier.includes(' / '))return r;const factory=directory.resolve(r.internalFields?.J||'',r.supplier,r.supplierCode||'',r.internalFields?.K||'');return factory?{...r,supplier:factory.code,supplierCode:factory.code,supplierName:factory.name,internalFields:{...r.internalFields,J:factory.code,K:factory.name}}:r;});
}
