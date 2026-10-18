import type {OrderItem} from '../types/order';
export function multiplePackRows(items:OrderItem[]){
 const rows:{code:string;name:string;kitCode:string;ratio:Record<string,number>;pieces:number;packs:number}[]=[];
 for(const item of items)for(const color of item.colors){
  const ratio=color.ratioBySize;
  if(!ratio||!Object.keys(ratio).length)continue;
  const pieces=Object.values(ratio).reduce((n,q)=>n+q,0),packs=color.totalQuantity/pieces;
  if(!(pieces>0)||!Number.isInteger(packs)||Object.entries(ratio).some(([size,q])=>!Number.isInteger(q)||q<0||(color.quantitiesBySize[size]||0)!==q*packs)||Object.keys(color.quantitiesBySize).some(size=>!ratio[size]&&color.quantitiesBySize[size]>0))throw new Error(`${item.itemNo}／${color.colorCode}：混碼配比與尺碼數量不符，請返回訂單核對。`);
  const key=JSON.stringify([color.colorCode,item.kitCode||'',ratio]),prior=rows.find(r=>JSON.stringify([r.code,r.kitCode,r.ratio])===key);
  if(prior)prior.packs+=packs;else rows.push({code:color.colorCode,name:color.colorName,kitCode:item.kitCode||'',ratio,pieces,packs});
 }
 return rows;
}
