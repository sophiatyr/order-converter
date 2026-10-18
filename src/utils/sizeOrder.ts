const clothing=['XXS','XS','S','M','L','XL','XXL','2XL','XXXL','3XL','4XL','5XL','6XL'];
const natural=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
/** Sort labels for presentation; quantities must always be looked up by label. */
export function orderedSizes(sizes:readonly string[]):string[]{
 const rank=(size:string)=>{const value=size.trim().toUpperCase(),index=clothing.indexOf(value);if(index>=0)return [1,index];return /^\d/.test(value)?[0,0]:[2,0];};
 return [...sizes].sort((a,b)=>{const left=rank(a),right=rank(b);return left[0]-right[0]||left[1]-right[1]||natural.compare(a,b);});
}
