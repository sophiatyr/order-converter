import type {Colorway} from '../types/order';
import type {DocumentTemplates} from './referenceDocuments';
import type {ProductNote} from './workspace';
const en=(s:string)=>s.toUpperCase().replace(/\b\d{1,2}-\d{3,4}\s*(?:TPG|TCX|TPX)?\b/g,'').replace(/[^A-Z]/g,'');
const code=(s:string)=>/^\d+$/.test(s.trim())?String(Number(s.trim())):s.trim().toUpperCase();
export const colorTranslationKey=(c:Pick<Colorway,'colorCode'|'colorName'>)=>`${c.colorCode.trim()}|${c.colorName.trim().toUpperCase()}`;
export function colorChinese(c:Pick<Colorway,'colorCode'|'colorName'>,style:string,po:string,templates:DocumentTemplates|undefined,note?:ProductNote){
 const manual=note?.colorTranslations?.[colorTranslationKey(c)];if(manual!==undefined)return manual;
 const sheets=(templates?.templates||[]).filter(t=>t.kind==='quantity'&&t.itemNos.includes(style)&&t.poNumbers.includes(po));
 const found=new Set<string>();
 for(const t of sheets)for(const cell of t.sheet.cells){
  // Some original quantity sheets combine (code), Chinese and English in one cell.
  if(typeof cell.v==='string'){
   const combined=cell.v.match(/^\(([^)]+)\)\s*([\s\S]+)$/);
   if(combined&&code(combined[1])===code(c.colorCode)){
    const name=combined[2],expected=en(c.colorName),actual=en(name);
    const socksAlias=style==='RCL006'&&expected==='DRESSBLUESWHITE'&&actual==='DRESSBLUEWHITE';
    if(actual===expected||socksAlias){const zh=name.split(/\r?\n/).filter(line=>/[\u3400-\u9fff]/.test(line)).join(' ').trim();if(zh)found.add(zh);}
   }
  }
  if(code(String(cell.v??''))!==code(c.colorCode))continue;
  for(const name of t.sheet.cells.filter(n=>n.r===cell.r&&typeof n.v==='string'&&/[\u3400-\u9fff]/.test(n.v)&&/[A-Za-z]/.test(n.v))){
   if(en(name.v)!==en(c.colorName))continue;
   const zh=(name.v.match(/[\u3400-\u9fff]+/g)||[]).join('');if(zh)found.add(zh);
  }
 }
 return found.size===1?[...found][0]:'';
}
