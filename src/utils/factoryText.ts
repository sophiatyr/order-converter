import type {OrderData,OrderItem} from '../types/order';
import type {Workspace,ProductNote} from './workspace';
import type {CsqReference} from './csqReferences';
const hasChinese=(value:string)=>/[\u3400-\u9fff]/.test(value);
const english=(...values:(string|undefined)[])=>values.find(v=>v?.trim()&&!hasChinese(v))?.trim()||'';
const chinese=(...values:(string|undefined)[])=>values.find(v=>v?.trim()&&hasChinese(v))?.trim()||'';
const bilingual=(en:string,zh:string)=>[en,zh&&zh!==en?zh:''].filter(Boolean).join('\n');
export function materialPairs(en:string,zh:string){
 const material=en.replace(/^.*?Products?\s+composition\s*[:：]\s*/i,'');
 const raw=material.split(/\r?\n|(?=\bLINN?ING\s*:)/i).map(s=>s.trim()).filter(Boolean),english:string[]=[];
 let heading='';for(const line of raw){if(/^(WOVEN|KNITTED|KNIT)$/i.test(line)){heading=line;continue;}english.push([heading,line].filter(Boolean).join('\n'));heading='';}if(heading)english.push(heading);
 const chinese=zh.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 if(english.length<=1){
  const multiple=chinese.slice(1).some(line=>/^(?:主布|面料\s*\d+|內裡|内里|裡布|裏布|配布|BODY|LINING)\s*[:：]/i.test(line));
  return {pairs:[{english:english[0]||'',chinese:multiple?'':zh.trim()}].filter(p=>p.english||p.chinese),unpaired:multiple?zh.trim():''};
 }
 if(chinese.length===english.length)return {pairs:english.map((text,index)=>({english:text,chinese:chinese[index]})),unpaired:''};
 return {pairs:english.map(text=>({english:text,chinese:''})),unpaired:zh.trim()};
}
export function factoryText(item:OrderItem,note?:ProductNote,ref?:CsqReference){
 const zhName=(item.factoryText?.chineseName??note?.chineseName??chinese(ref?.name,item.chineseName)).trim();
 const zhSpec=(item.factoryText?.chineseSpec??note?.chineseSpec??chinese(ref?.spec,item.chineseSpec)).trim();
 const enName=english(ref?.name,item.styleName.replace(/\s*-\s*Products composition:.*$/i,''),item.chineseName);
 const enSpec=['erp','manual','product'].includes(item.compositionSource||'')?item.composition||item.description:english(ref?.spec,item.description,item.composition,item.chineseSpec);
 const materials=materialPairs(enSpec,zhSpec);
 return {chineseName:zhName,chineseSpec:zhSpec,name:bilingual(enName,zhName),spec:[...materials.pairs.map(p=>bilingual(p.english,p.chinese)),materials.unpaired].filter(Boolean).join('\n'),materials};
}
export function saveFactoryText(order:OrderData,w:Workspace,style:string,values:{chineseName:string;chineseSpec:string},sync:boolean){
 const text={chineseName:values.chineseName.trim(),chineseSpec:values.chineseSpec.trim()};
 const nextOrder={...order,items:order.items.map(item=>item.itemNo===style?{...item,factoryText:sync?undefined:text}:item)};
 const nextWorkspace=sync?{...w,productNotes:{...w.productNotes,[style]:{...(w.productNotes[style]||{brand:order.brand||'',season:order.season||'',series:order.series||'',remarks:''}),...text}}}:w;
 return {order:nextOrder,workspace:nextWorkspace};
}
