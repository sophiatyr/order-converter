import {canonicalBrand,canonicalSeason,canonicalSeries,normalizeClassification,isBrandOnlySeries,completeSeasonChoices,compareSeasons} from './classification';
import {inferProductBrand} from './productCatalog';
import type {ErpSnapshot} from './erpProducts';
import {seasonOf,type Workspace,type ReferenceSnapshot} from './workspace';

export type ClassificationKind='brand'|'season'|'series'|'factory';
export type ClassificationOption={kind:ClassificationKind;value:string};
export const classificationKinds:ClassificationKind[]=['brand','season','series','factory'];
// Current PO planning window: SS26/FW26 through SS28/FW28 in 2026.
// Explicitly added seasons stay available; historical reference seasons do not
// expand this menu. SelectWithAdd also retains the order's current value.
export function orderSeasonChoices(w:Workspace,firstYear=new Date().getFullYear()){
 const defaults=Array.from({length:3},(_,n)=>['SS','FW'].map(prefix=>prefix+String(firstYear+n).slice(-2))).flat();
 const added=Object.values(w.classificationOptions||{}).filter(option=>option.kind==='season').flatMap(option=>canonicalSeason(option.value).split(' / '));
 return [...new Set([...defaults,...added].filter(Boolean))].sort(compareSeasons);
}
export function normalizeOption(kind:ClassificationKind,value:string){return kind==='brand'?canonicalBrand(value):kind==='season'?canonicalSeason(value):kind==='series'?canonicalSeries(value):value.trim().toUpperCase();}
export function addClassificationOption(w:Workspace,kind:ClassificationKind,value:string):Workspace{
 const normalized=normalizeOption(kind,value);
 if(!normalized||normalized.length>120||/[\u0000-\u001f]/.test(normalized))throw new Error('選項格式不符。');
 return {...w,classificationOptions:{...w.classificationOptions,[`${kind}:${normalized}`]:{kind,value:normalized}}};
}
export function classificationChoices(w:Workspace,refs:ReferenceSnapshot|null,erp:ErpSnapshot|null){
 const values:Record<ClassificationKind,Set<string>>={brand:new Set(),season:new Set(['SS26','FW26','SS27','FW27','SS28','FW28']),series:new Set(),factory:new Set()};
 const add=(kind:ClassificationKind,value?:string)=>{for(const part of normalizeOption(kind,value||'').split(' / '))if(part)values[kind].add(part);};
 for(const r of [...(refs?.tracking||[]),...(refs?.orders||[]),...w.orders,...w.developments,...Object.values(w.productNotes),...Object.values(w.tracking)]){
  const classification=normalizeClassification(r);
  add('brand',classification.brand);add('season',classification.season);add('series',classification.series);
  if('supplierCode' in r)add('factory',r.supplierCode);
 }
 for(const option of Object.values(w.classificationOptions||{}))add(option.kind,option.value);
 for(const product of erp?.products||[]){add('brand',inferProductBrand(product.itemNo,product.chineseName));add('season',seasonOf(product.itemNo));add('factory',product.supplierCode);for(const q of product.quotes||[])add('factory',q.supplierCode);}
 for(const order of w.orders)for(const item of order.items)add('factory',item.factoryProduct?.supplierCode);
 for(const note of Object.values(w.productNotes))for(const price of note.prices||[])if(price.kind==='factory')add('factory',price.party);
 values.series=new Set([...values.series].filter(series=>!isBrandOnlySeries(series,[...values.brand])));
 return Object.fromEntries(classificationKinds.map(kind=>[kind,kind==='season'?completeSeasonChoices([...values.season]):[...values[kind]].sort()])) as Record<ClassificationKind,string[]>;
}
