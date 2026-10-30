import {internalPoFonts} from './internalPoFonts';
import JSZip from 'jszip';
import type {internalTemplatePayload} from './internalTrackingTemplate';
type Payload=ReturnType<typeof internalTemplatePayload>;
export interface InternalTemplateBlueprint {version:number;rows:{row:number;sc:string;po:string;style:string;factory:string;hasTotals:boolean;conversionRate?:number|null}[]}
const xml=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const col=(i:number)=>{let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;};
export async function buildPortableInternalTracking(template:ArrayBuffer|Uint8Array,blueprint:InternalTemplateBlueprint,payload:Payload,today=new Date()){
 if(blueprint.version!==1||!Array.isArray(blueprint.rows)||!payload.rows.length||payload.rows.length>3000||payload.rows.some(r=>r.values.length!==46))throw Error('內部原表資料或範本格式不符。');
 const zip=await JSZip.loadAsync(template),part=zip.file('xl/worksheets/sheet1.xml');if(!part)throw Error('內部原表缺少工作表。');
 const stylesFile=zip.file('xl/styles.xml');if(!stylesFile)throw Error('內部原表缺少樣式檔。');const poFonts=internalPoFonts(await stylesFile.async('string'));
 let sheet=await part.async('string');const sheetData=sheet.match(/<sheetData\b[^>]*>[\s\S]*?<\/sheetData>/)?.[0];if(!sheetData)throw Error('內部原表缺少明細區。');
 const sourceRows=new Map<number,{attrs:string;raw:string;cells:Map<string,string>}>();
 for(const m of sheetData.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)){const ri=Number(m[1].match(/\br="(\d+)"/)?.[1]);const cells=new Map<string,string>();for(const c of m[2].matchAll(/<c\b([^>]*)(?:\/>|>[\s\S]*?<\/c>)/g)){const key=c[1].match(/\br="([A-Z]+)\d+"/)?.[1];if(key)cells.set(key,c[1]);}sourceRows.set(ri,{attrs:m[1],raw:m[0],cells});}
 const groups=new Map<string,Payload['rows']>();for(const r of payload.rows){const k=JSON.stringify([r.sc,r.po]);groups.set(k,[...(groups.get(k)||[]),r]);}
 const mappings:{record:Payload['rows'][number];from:number;to:number;original:boolean}[]=[],ranges:{first:number;last:number;complete:boolean}[]=[];
 for(const records of groups.values()){
  const entries=records.map(record=>{let matches=blueprint.rows.filter(r=>r.sc===record.sc&&r.po===record.po&&record.aliases.includes(r.style));if(matches.length>1)matches=matches.filter(r=>r.factory===record.factory);if(matches.length>1)throw Error(`${record.po} / ${record.style} 在原表重複，請核對工廠。`);return {record,original:matches.length===1,from:matches[0]?.row||blueprint.rows.find(r=>r.factory===record.factory&&r.hasTotals)?.row||5};}).sort((a,b)=>a.original&&b.original?a.from-b.from:a.original?-1:b.original?1:0);
  const first=5+mappings.length,originals=blueprint.rows.filter(r=>r.sc===records[0].sc&&r.po===records[0].po&&r.style),complete=originals.length===entries.length&&entries.every(e=>e.original);
  for(const e of entries)mappings.push({...e,to:5+mappings.length});ranges.push({first,last:4+mappings.length,complete});
 }
 const values=new Map<string,string|number|null>(),formulas=new Map<string,string>(),cached=new Map<string,number>(),merges:string[]=[];
 for(const m of mappings)for(let c=0;c<46;c++)values.set(col(c)+m.to,m.record.values[c]);
 const merge=(c:string,first:number,last:number)=>{if(last<=first)return;merges.push(`${c}${first}:${c}${last}`);for(let r=first+1;r<=last;r++){values.set(c+r,null);formulas.delete(c+r);cached.delete(c+r);}};
 const originalMerges=[...sheet.matchAll(/<mergeCell\b[^>]*\bref="([^"]+)"[^>]*\/>/g)].map(m=>m[1]),rowMap=new Map(mappings.filter(m=>m.original).map(m=>[m.from,m.to]));
 for(const ref of originalMerges){const m=ref.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);if(!m)continue;const first=Number(m[2]),last=Number(m[4]);if(first<5){merges.push(ref);continue;}const a=rowMap.get(first),b=rowMap.get(last);if(m[1]===m[3]&&a&&b&&ranges.some(g=>g.complete&&g.first<=a&&g.last>=b))merge(m[1],a,b);}
 const excelToday=(Date.UTC(today.getFullYear(),today.getMonth(),today.getDate())-Date.UTC(1899,11,30))/86400000;
 for(const g of ranges){
  if(!g.complete)for(const c of ['H','I','N'])merge(c,g.first,g.last);
  const costRefs:string[]=[],costValues:(number|null)[]=[];let r=g.first;
  while(r<=g.last){const record=mappings[r-5].record;let end=r;while(end<g.last&&mappings[end-4].record.scopes.L===record.scopes.L)end++;
   if(!g.complete)for(const c of ['L','M'])merge(c,r,end);
   const mapping=mappings[r-5],sourceRate=mapping.original?blueprint.rows.find(x=>x.row===mapping.from)?.conversionRate:null,rate=record.rate||sourceRate,currency=record.currency||(mapping.original?(sourceRate?'RMB':'USD'):'');
   const amount=values.get('L'+r);if(currency==='RMB'||currency==='CNY'){costRefs.push('M'+r);if(rate&&rate>0){formulas.set('M'+r,`L${r}/${rate}`);if(typeof amount==='number')cached.set('M'+r,amount/rate);costValues.push(typeof amount==='number'?amount/rate:null);}else{values.set('M'+r,null);costValues.push(null);}}
   else if(currency==='USD'){values.set('M'+r,null);costRefs.push('L'+r);costValues.push(typeof amount==='number'?amount:null);}
   else{values.set('M'+r,null);costRefs.push('M'+r);costValues.push(null);}r=end+1;
  }
  const h=values.get('H'+g.first),refs=costRefs.join(',');formulas.set('N'+g.first,`IF(AND(ISNUMBER(H${g.first}),H${g.first}<>0,COUNT(${refs})=${costRefs.length}),(H${g.first}-SUM(${refs}))/H${g.first},"")`);
  if(typeof h==='number'&&h!==0&&costValues.every(v=>v!==null))cached.set('N'+g.first,(h-costValues.reduce<number>((a,b)=>a+(b||0),0))/h);
 }
 for(const m of mappings){formulas.set('V'+m.to,`IF(ISNUMBER(U${m.to}),U${m.to}-TODAY(),"")`);const date=values.get('U'+m.to);if(typeof date==='number')cached.set('V'+m.to,date-excelToday);}
 const resultRows=[...sourceRows].filter(([r])=>r<5).map(([,r])=>r.raw);
 for(const m of mappings){const source=sourceRows.get(m.from)||sourceRows.get(5);if(!source)throw Error('內部原表缺少列格式。');const attrs=source.attrs.replace(/\br="\d+"/,`r="${m.to}"`);let cells='';for(let c=0;c<46;c++){const key=col(c),address=key+m.to,style=poFonts.style(Number(source.cells.get(key)?.match(/\bs="(\d+)"/)?.[1]||0),m.record.po),base=`r="${address}"${style?` s="${style}"`:''}`,formula=formulas.get(address),v=values.get(address);if(formula)cells+=`<c ${base}><f>${xml(formula)}</f>${cached.has(address)?`<v>${cached.get(address)}</v>`:''}</c>`;else if(typeof v==='number')cells+=`<c ${base}><v>${v}</v></c>`;else if(v!==null&&v!==undefined&&v!=='')cells+=`<c ${base} t="inlineStr"><is><r><rPr><color rgb="${poFonts.color(m.record.po)}"/></rPr><t xml:space="preserve">${xml(v)}</t></r></is></c>`;else cells+=`<c ${base}/>`;}resultRows.push(`<row${attrs}>${cells}</row>`);}
 const end=4+mappings.length;sheet=sheet.replace(sheetData,`${sheetData.match(/^<sheetData\b[^>]*>/)![0]}${resultRows.join('')}</sheetData>`).replace(/<dimension\b[^>]*\/>/,`<dimension ref="A1:AT${end}"/>`).replace(/<autoFilter\b[^>]*\/>/,`<autoFilter ref="A4:AT${end}"/>`).replace(/<mergeCells\b[^>]*>[\s\S]*?<\/mergeCells>/,`<mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`);
 zip.file('xl/styles.xml',poFonts.finish());zip.file('xl/worksheets/sheet1.xml',sheet);let book=await zip.file('xl/workbook.xml')!.async('string');book=book.replace(/<calcPr\b[^>]*\/>/,'<calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/>').replace(/(<definedName\b[^>]*name="_xlnm\.(Print_Area|_FilterDatabase)"[^>]*>)[\s\S]*?(<\/definedName>)/g,(_,a,name,b)=>a+`'CSQ'!$A$${name==='_FilterDatabase'?4:1}:$AT$${end}`+b);zip.file('xl/workbook.xml',book);
 return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
