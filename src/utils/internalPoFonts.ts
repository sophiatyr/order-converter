/** Append colour variants; leave original fonts, formats and header styles intact. */
export function internalPoFonts(source:string){
 const fontsPart=source.match(/<fonts\b[^>]*>[\s\S]*?<\/fonts>/)?.[0];
 const stylesPart=source.match(/<cellXfs\b[^>]*>[\s\S]*?<\/cellXfs>/)?.[0];
 if(!fontsPart||!stylesPart)throw Error('內部原表缺少字體或儲存格樣式。');
 const fonts=[...fontsPart.matchAll(/<font\b[^>]*(?:\/>|>[\s\S]*?<\/font>)/g)].map(m=>m[0]);
 const styles=[...stylesPart.matchAll(/<xf\b[^>]*(?:\/>|>[\s\S]*?<\/xf>)/g)].map(m=>m[0]);
 const addedFonts:string[]=[],addedStyles:string[]=[],fontCache=new Map<string,number>(),styleCache=new Map<string,number>(),poColors=new Map<string,string>();
 const palette=['FF156082','FF7030A0','FF196B24','FF9C3D10'];
 const attr=(tag:string,key:string,value:number)=>new RegExp(`\\b${key}="[^"]*"`).test(tag)?tag.replace(new RegExp(`\\b${key}="[^"]*"`),()=>`${key}="${value}"`):tag.replace(/<xf\b/,()=>`<xf ${key}="${value}"`);
 const style=(original:number,po:string)=>{
  if(!poColors.has(po))poColors.set(po,palette[poColors.size%palette.length]);
  const color=poColors.get(po)!,key=original+'|'+color;
  if(styleCache.has(key))return styleCache.get(key)!;
  const xf=styles[original];if(!xf)throw Error('內部原表儲存格樣式不存在。');
  const oldFont=Number(xf.match(/\bfontId="(\d+)"/)?.[1]||0),fontKey=oldFont+'|'+color;
  let fontId=fontCache.get(fontKey);
  if(fontId===undefined){
   const font=fonts[oldFont];if(!font)throw Error('內部原表字體不存在。');
   const colour=`<color rgb="${color}"/>`;
   const variant=/<color\b/.test(font)?font.replace(/<color\b[^>]*(?:\/>|>[\s\S]*?<\/color>)/,()=>colour):font.endsWith('/>')?font.replace(/\/>$/,()=>`>${colour}</font>`):font.replace('</font>',()=>colour+'</font>');
   fontId=fonts.length+addedFonts.length;addedFonts.push(variant);fontCache.set(fontKey,fontId);
  }
  const result=styles.length+addedStyles.length;addedStyles.push(attr(attr(xf,'fontId',fontId),'applyFont',1));styleCache.set(key,result);return result;
 };
 const finish=()=>source.replace(fontsPart,()=>fontsPart.replace(/\bcount="\d+"/,()=>`count="${fonts.length+addedFonts.length}"`).replace('</fonts>',()=>addedFonts.join('')+'</fonts>')).replace(stylesPart,()=>stylesPart.replace(/\bcount="\d+"/,()=>`count="${styles.length+addedStyles.length}"`).replace('</cellXfs>',()=>addedStyles.join('')+'</cellXfs>'));
 return {style,finish,color:(po:string)=>poColors.get(po)!};
}
