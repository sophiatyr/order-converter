/** Local CSQ multiple-pack reconciliation, following SK-KPI csq_multiple.py. */
export interface MultipleKit {vendor:string;style:string;color:string;colorName:string;description:string;code:string;component:string;packs:number;perPack:number;packPrice:number;amount:number;sizes:Record<string,number>;ratios:Record<string,number>}
const number=(value:string)=>Number(value.replace(/,/g,''));
const integer=(value:string,label:string)=>{const n=number(value);if(!Number.isSafeInteger(n)||n<=0)throw new Error(`${label}須為正整數`);return n;};
const code=/^S\d+$/;
export function readMultipleKits(rows:string[][]):MultipleKit[]{
 const section=rows.flatMap((row,i)=>/\bKit\s+composition\b/i.test(row.join(' '))?[i]:[]);if(section.length!==1)throw new Error('需要唯一完整的 Kit composition，請確認頁數');
 const main=rows.slice(0,section[0]),composition=rows.slice(section[0]+1);
 const headers=composition.filter(row=>row.some(c=>/^Pieces\/Kit$/i.test(c)));if(headers.length!==1||!headers[0].some(c=>/^Total Pieces$/i.test(c)))throw new Error('Kit composition 欄位不完整');
 const starts=main.flatMap((row,i)=>/^[A-Z][A-Z0-9-]*\/\d+/.test(row[0]||'')?[i]:[]),sales=new Map<string,{vendor:string;packs:number;packPrice:number;amount:number}>();
 for(const [n,start] of starts.entries()){
  const body=main.slice(start,starts[n+1]??main.length),first=body[0][0].match(/^([A-Z][A-Z0-9-]*\/\d+)/)!;let vendor=first[1];
  if(/^\d+$/.test(body[1]?.[0]||'')&&!/\bPZ\b/.test(body[1].join(' ')))vendor+=body[1][0];
  const codes=[...new Set(body.filter(row=>row.length>=2&&code.test(row.at(-1)!)).map(row=>row.at(-1)!))];if(codes.length!==1||sales.has(codes[0]))throw new Error(`${vendor} 客戶 kit code 缺少或重複`);
  const unit=body.filter(row=>/\bPZ\b/.test(row.join(' ')));if(unit.length!==1)throw new Error(`${vendor} 包數／包價列不完整`);
  const match=unit[0].join(' ').match(/^0\s+([\d,.]+)\s+PZ\s+([\d,.]+)\s+([\d,.]+)$/i);if(!match)throw new Error(`${vendor} 包數／包價格式或折扣不支援`);
  const packs=integer(match[1],'包數'),packPrice=number(match[2]),amount=number(match[3]);if(!(packPrice>0)||Math.abs(packs*packPrice-amount)>.005)throw new Error(`${vendor} 包數乘包價與金額不符`);
  sales.set(codes[0],{vendor,packs,packPrice,amount});
 }
 if(!sales.size)throw new Error('未找到混碼包裝主明細');
 const segments=composition.flatMap((row,i)=>code.test(row[0]||'')?[i]:[]),kits:MultipleKit[]=[];let current:MultipleKit|undefined;
 for(const [n,start] of segments.entries()){
  const body=composition.slice(start,segments[n+1]??composition.length),row=body[0];let vendor=row[2]||'';
  if(/^\d+$/.test(body[1]?.[0]||''))vendor+=body[1][0];
  const kitSale=sales.get(row[0]);
  if(kitSale){
   if(kits.some(k=>k.code===row[0]))throw new Error('Kit code 重複');if(vendor!==kitSale.vendor)throw new Error(`${row[0]} 主表與組成表品號不符`);
   const packs=integer(row.at(-3)!,'Kit 包數'),perPack=integer(row.at(-2)!,'每包件數'),total=integer(row.at(-1)!,'展開件數');
   if(packs!==kitSale.packs||packs*perPack!==total)throw new Error(`${vendor} 包數／每包件數／總件數不符`);
   const match=vendor.match(/^(.+)\/(\d+)$/)!;current={...kitSale,style:match[1],color:match[2],colorName:'',description:'',code:row[0],component:'',perPack,sizes:{},ratios:{}};kits.push(current);
  }else{
   if(!current||!vendor.includes('-'))throw new Error(`${row[0]} 組成明細缺少 Kit 抬頭`);
   const size=row.at(-3)!.toUpperCase(),ratio=integer(row.at(-2)!,'尺碼配比'),qty=integer(row.at(-1)!,'尺碼件數');
   const colorText=row.slice(3,-3).join(' '),match=colorText.match(/^(\d+)\s+(.+)$/);if(!match||vendor!==`${current.style}-${current.color}`||match[1]!==current.color)throw new Error(`${current.code} 組成款號或顏色不符`);
   if(!/^(?:\d{1,3}A|XXS|XS|S|M|L|XL|XXL|XXXL|[3-6]XL|UNI)$/.test(size)||size in current.sizes)throw new Error(`${current.code} 尺碼無效或重複`);
   if(ratio*current.packs!==qty)throw new Error(`${current.code} 尺碼配比乘包數與件數不符`);
   // Wrapped vendor digits and wrapped colour names are separate continuations.
   const continuation:string[][]=[];for(const line of body.slice(1)){if(!/^\d+$/.test(line[0]||'')||line.length>2)break;continuation.push(line);}let name=match[2];for(const [i,line] of continuation.entries())name+=' '+(i===0?line.slice(1).join(' '):line.join(' '));name=name.trim().replace(/(?<=\d)-\s+(?=\d)/g,'-').replace(/\s+-/g,'-');
   if(current.component&&(current.component!==row[0]||current.colorName!==name))throw new Error(`${current.code} 組成商品碼／色名不一致`);
   current.component=row[0];current.colorName=name;if(!current.description)current.description=row[1];current.sizes[size]=qty;current.ratios[size]=ratio;
  }
 }
 if(kits.length!==sales.size)throw new Error('主表與組成表 Kit 數量不符，可能缺頁');
 if(new Set(kits.map(kit=>kit.vendor)).size!==kits.length)throw new Error('同款同色存在多個 Kit，需核對訂單組成');
 for(const kit of kits){if(Object.values(kit.ratios).reduce((a,b)=>a+b,0)!==kit.perPack||Object.values(kit.sizes).reduce((a,b)=>a+b,0)!==kit.packs*kit.perPack)throw new Error(`${kit.code} 配比合計／展開件數不符`);const price=kit.packPrice/kit.perPack;if(Math.abs(price-Math.round(price*1e6)/1e6)>1e-9)throw new Error(`${kit.code} 包價不能精確換算件價`);}
 return kits;
}
