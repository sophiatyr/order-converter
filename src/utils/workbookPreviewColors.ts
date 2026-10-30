import JSZip from 'jszip';

const unescape=(s:string)=>s.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const attrs=(s:string)=>Object.fromEntries([...s.matchAll(/([\w:]+)="([^"]*)"/g)].map(m=>[m[1],unescape(m[2])]));
/** Read display colours without rewriting the workbook used for download. */
export async function workbookPreviewColors(bytes:Uint8Array):Promise<Record<string,Record<string,string>>>{
 const zip=await JSZip.loadAsync(bytes),styles=await zip.file('xl/styles.xml')?.async('string');
 if(!styles)return {};
 const fonts=[...(styles.match(/<fonts\b[^>]*>[\s\S]*?<\/fonts>/)?.[0]||'').matchAll(/<font\b[^>]*(?:\/>|>[\s\S]*?<\/font>)/g)].map(m=>{
  const rgb=m[0].match(/<color\b[^>]*\brgb="([A-Fa-f0-9]{6,8})"/)?.[1];return rgb?'#'+rgb.slice(-6):'';
 });
 const colors=[...(styles.match(/<cellXfs\b[^>]*>[\s\S]*?<\/cellXfs>/)?.[0]||'').matchAll(/<xf\b[^>]*(?:\/>|>[\s\S]*?<\/xf>)/g)].map(m=>fonts[Number(attrs(m[0]).fontId||0)]||'');
 const [book,rels]=await Promise.all([zip.file('xl/workbook.xml')?.async('string'),zip.file('xl/_rels/workbook.xml.rels')?.async('string')]);
 const targets=new Map([...(rels||'').matchAll(/<Relationship\b([^>]*)\/>/g)].map(m=>{const a=attrs(m[1]);return [a.Id,a.Target];}));
 const result:Record<string,Record<string,string>>={};
 for(const match of (book||'').matchAll(/<sheet\b([^>]*)\/>/g)){
  const a=attrs(match[1]),target=targets.get(a['r:id']);if(!target)continue;
  const parts:string[]=[];for(const part of (target.startsWith('/')?target.slice(1):'xl/'+target).split('/')){if(part==='..')parts.pop();else if(part&&part!=='.')parts.push(part);}
  const sheet=await zip.file(parts.join('/'))?.async('string');if(!sheet)continue;
  const cells:Record<string,string>={};
  for(const cell of sheet.matchAll(/<c\b([^>]*)\/?\s*>/g)){const c=attrs(cell[1]),color=colors[Number(c.s||0)];if(c.r&&color)cells[c.r]=color;}
  result[a.name]=cells;
 }
 return result;
}
