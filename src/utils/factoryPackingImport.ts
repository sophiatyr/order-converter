import * as XLSX from 'xlsx';
import type {Shipment} from './workspace';
import {withCartons,type CartonRow} from './shipmentPacking';
import {newId} from './uid';
export async function readFactoryPacking(file:File,s:Shipment){
 const book=XLSX.read(await file.arrayBuffer(),{type:'array'}),sheet=book.Sheets['工廠裝箱明細'];
 if(!sheet)throw Error('請使用「工廠標準裝箱清單」；其他工廠原表請先整理到標準格式，避免誤讀。');
 const rows=XLSX.utils.sheet_to_json<unknown[]>(sheet,{header:1,defval:''});
 return parseFactoryPackingRows(rows,s);
}
export function parseFactoryPackingRows(rows:unknown[][],s:Shipment):Shipment{
 const text=(v:unknown)=>String(v??'').trim(),number=(v:unknown)=>v===''||v===null||v===undefined?NaN:Number(v);
 if(text(rows[3]?.[1])!==s.scNumber||text(rows[3]?.[4])!==s.poNumber)throw Error('裝箱清單的 S/C 或客戶 PO 與目前批次不同，未套用。');
 if(text(rows[5]?.[0])!=='箱號起'||text(rows[5]?.[9])!=='每箱該尺碼件數')throw Error('工廠標準清單欄位不符，未套用。');
 const groups=new Map<string,{line:string;box:CartonRow;mode:string;packs:number}>();let count=0;
 for(let i=6;i<rows.length;i++){
  const row=rows[i];if(!row.slice(0,9).some(v=>text(v)!=='')||[row[0],row[1],row[7]].every(v=>text(v)===''))continue;
  const from=number(row[0]),to=number(row[1]),sku=text(row[2]),code=text(row[3]),color=text(row[4]),mode=text(row[5]).toUpperCase(),size=text(row[6]),ratio=number(row[7]),packs=mode==='MULTIPLE PACK'?number(row[8]):1;
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<1||to<from||!['NORMAL PACK','MULTIPLE PACK'].includes(mode)||!Number.isInteger(ratio)||ratio<0||!Number.isInteger(packs)||packs<=0)throw Error(`第 ${i+1} 列：請核對箱號、包裝方式、尺碼數量與包數。`);
  const matches=s.lines.filter(l=>l.itemNo===sku&&l.color===`${code} ${color}`.trim()&&size in l.sizes);if(matches.length!==1)throw Error(`第 ${i+1} 列：款號／色碼／色名／尺碼無法唯一對應 PO，未套用。`);
  const line=matches[0];if(!(size in line.sizes))throw Error(`第 ${i+1} 列：尺碼 ${size} 不在 PO，未套用。`);
  const nw=number(row[12]),gw=number(row[13]),dimensions=[14,15,16].map(c=>number(row[c]));if(!Number.isFinite(nw)||nw<=0||!Number.isFinite(gw)||gw<nw||dimensions.some(v=>!Number.isFinite(v)||v<=0))throw Error(`第 ${i+1} 列：請核對每箱淨重、毛重與長寬高。`);
  const key=JSON.stringify([line.id,from,to]),prior=groups.get(key),cbm=dimensions.reduce((n,v)=>n*v,1)/1000000,measurement=dimensions.join('X')+'CM';
  if(prior&&(prior.mode!==mode||prior.packs!==packs||prior.box.netWeight!==nw||prior.box.grossWeight!==gw||prior.box.measurement!==measurement))throw Error(`第 ${i+1} 列：相同箱號的包裝、重量或外箱尺寸不一致。`);
  const group=prior||{line:line.id,mode,packs,box:{id:newId(),from,to,sizes:{},netWeight:nw,grossWeight:gw,cbm,measurement}};
  if(Object.hasOwn(group.box.sizes,size))throw Error(`第 ${i+1} 列：相同箱號／尺碼重複。`);
  group.box.sizes[size]=ratio*packs;groups.set(key,group);count++;
 }
 if(!count)throw Error('清單沒有可套用的裝箱明細。');
 const packing=Object.fromEntries([...groups].map(([key,g])=>[key,{mode:g.mode,packs:g.packs}]));
 return {...s,confirmed:false,factoryNotice:{...s.factoryNotice,standardPacking:JSON.stringify(packing)},lines:s.lines.map(l=>{const boxes=[...groups.values()].filter(g=>g.line===l.id).map(g=>({...g.box,sizes:Object.fromEntries(Object.keys(l.sizes).map(size=>[size,g.box.sizes[size]||0]))}));return boxes.length?withCartons(l,boxes):{...l,packingRows:[],sizes:Object.fromEntries(Object.keys(l.sizes).map(size=>[size,0])),cartons:0,netWeight:0,grossWeight:0,cbm:0};})};
}
