import type {Shipment,Workspace,TrackingRecord} from './workspace';
export interface ShipmentLc {number:string;date:string;bank:string;lineIds:string[]}
function normalize(entries:ShipmentLc[]){
 const result:ShipmentLc[]=[];
 for(const raw of entries){const e={...raw,number:raw.number.trim(),date:raw.date.trim(),bank:raw.bank,lineIds:[...new Set(raw.lineIds)]};if(!e.number&&!e.date&&!e.bank.trim())continue;const existing=e.number&&result.find(x=>x.number===e.number&&(!x.date||!e.date||x.date===e.date)&&(!x.bank||!e.bank||x.bank===e.bank));if(existing){existing.date||=e.date;existing.bank||=e.bank;existing.lineIds=[...new Set([...existing.lineIds,...e.lineIds])];}else result.push(e);}
 return result;
}
export function shipmentLcs(s:Shipment):ShipmentLc[]{
 if(s.factoryNotice?.lcEntries){const entries=JSON.parse(s.factoryNotice.lcEntries);if(!Array.isArray(entries)||entries.some(e=>typeof e.number!=='string'||typeof e.date!=='string'||typeof e.bank!=='string'||!Array.isArray(e.lineIds)||e.lineIds.some((id:unknown)=>typeof id!=='string')))throw Error('L/C 對應資料格式不符');return normalize(entries);}
 return s.factoryNotice?.lcNumber?[{number:s.factoryNotice.lcNumber,date:s.factoryNotice.lcIssueDate||'',bank:s.factoryNotice.lcIssueBank||'',lineIds:s.lines.map(l=>l.id)}]:[];
}
export function lcForLine(s:Shipment,lineId:string){const entries=shipmentLcs(s).filter(e=>e.number.trim());if(entries.length>1&&!s.confirmed)throw Error('每張 PO 只能對應一個 L/C，請在本櫃 L/C 統一號碼。');if(entries.length===1)return entries[0].number;const matches=entries.filter(e=>e.lineIds.includes(lineId));if(matches.length>1||entries.length>0&&matches.length!==1)throw Error('請逐款色確認 L/C 對應，每款色應對應一張 L/C。');return matches[0]?.number||'';}
export function withShipmentLcs(s:Shipment,input:ShipmentLc[]):Shipment{
 if(s.confirmed)throw Error('已確認出貨不可更改 L/C。');
 const entries=normalize(input);if(entries.length>1)throw Error('每張 PO 只能對應一個 L/C，請統一 L/C 號碼。');if(entries.length===1)entries[0]={...entries[0],lineIds:s.lines.map(l=>l.id)};
 if(entries.some(e=>e.lineIds.some(id=>!s.lines.some(l=>l.id===id))))throw Error('L/C 對應款色不在本次出貨。');
 return {...s,factoryNotice:{...s.factoryNotice,lcEntries:JSON.stringify(entries),lcNumber:[...new Set(entries.map(e=>e.number).filter(Boolean))].join(' / '),lcIssueDate:entries.length===1?entries[0].date:entries.filter(e=>e.number).map(e=>`${e.number}: ${e.date}`).join('\n'),lcIssueBank:entries.length===1?entries[0].bank:entries.filter(e=>e.number).map(e=>`${e.number}: ${e.bank}`).join('\n'),customerDocumentsExported:''}};
}
/** A normal PO has one LC. Keep confirmed shipments as immutable history. */
export function setOrderLc(w:Workspace,rows:TrackingRecord[],po:string,sc:string,number:string,details?:{date:string;bank:string;replaceMultiple?:boolean}):Workspace{
 if(number.includes(' / ')||/[\r\n]/.test(number))throw Error('每張 PO 只能填寫一個 L/C 號碼。');
 const pending=w.shipments.filter(s=>!s.confirmed&&!s.factoryNotice?.batchDeletedAt&&s.poNumber===po&&s.scNumber===sc);
 if(!details?.replaceMultiple&&pending.some(s=>shipmentLcs(s).length>1))throw Error('此 PO 已有多張 L/C，請在「本櫃 L/C」選定一個號碼後儲存。');
 const tracking={...w.tracking};for(const r of rows.filter(r=>r.poNumber===po&&r.scNumber===sc))tracking[r.id]={...tracking[r.id],bulk:{...tracking[r.id]?.bulk,shipmentLc:number.trim()}};
 const ids=new Set(pending.map(s=>s.id));return {...w,tracking,shipments:w.shipments.map(s=>{if(!ids.has(s.id))return s;const old=shipmentLcs(s)[0];return withShipmentLcs(s,[{number:number.trim(),date:details?.date??old?.date??'',bank:details?.bank??old?.bank??'',lineIds:s.lines.map(l=>l.id)}]);})};
}

export function inheritOrderLc(s:Shipment,rows:TrackingRecord[],all:Shipment[]){const explicit=rows.filter(r=>r.poNumber===s.poNumber&&r.scNumber===s.scNumber&&r.bulk?.shipmentLc!==undefined);if(explicit.length&&explicit.every(r=>!r.bulk?.shipmentLc))return s;const prior=all.filter(x=>!x.factoryNotice?.batchDeletedAt&&x.poNumber===s.poNumber&&x.scNumber===s.scNumber).flatMap(shipmentLcs),tracked=[...new Set(rows.filter(r=>r.poNumber===s.poNumber&&r.scNumber===s.scNumber).map(r=>r.bulk?.shipmentLc||'').filter(Boolean))],numbers=[...new Set(prior.map(e=>e.number).filter(Boolean))],number=tracked.length===1?tracked[0]:tracked.length===0&&numbers.length===1?numbers[0]:'';if(!number||number.includes(' / '))return s;const details=prior.find(e=>e.number===number);return withShipmentLcs(s,[{number,date:details?.date||'',bank:details?.bank||'',lineIds:s.lines.map(l=>l.id)}]);}

export interface LcOrder {po:string;sc:string}
export const lcOrderKey=(o:LcOrder)=>JSON.stringify([o.po,o.sc]);
export function containerLcOrders(members:Shipment[],rows:TrackingRecord[]){
 return [...new Map(members.map(s=>{const entries=shipmentLcs(s),tracked=[...new Set(rows.filter(r=>r.poNumber===s.poNumber&&r.scNumber===s.scNumber).map(r=>r.bulk?.shipmentLc||'').filter(Boolean))],numbers=entries.length?entries.map(e=>e.number).filter(Boolean):tracked;return [lcOrderKey({po:s.poNumber,sc:s.scNumber}),{po:s.poNumber,sc:s.scNumber,numbers:[...new Set(numbers)],date:entries[0]?.date||'',bank:entries[0]?.bank||'',confirmed:s.confirmed}];})).values()];
}
/** A single LC covers multiple POs. Update pending batches and shared tracking atomically. */
export function setLcOrderGroup(w:Workspace,rows:TrackingRecord[],selected:LcOrder[],entry:{number:string;date:string;bank:string},previous?:{number:string;orders:LcOrder[]}){
 const number=entry.number.trim();if(!number||number.length>200||number.includes(' / ')||/[\r\n]/.test(number))throw Error('請填寫一個有效的 L/C 號碼。');
 if(!selected.length)throw Error('請至少選擇一張 PO。');
 if(entry.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)||isNaN(Date.parse(entry.date))||new Date(entry.date).toISOString().slice(0,10)!==entry.date))throw Error('開狀日期無效。');
 const chosen=[...new Map(selected.map(o=>[lcOrderKey(o),o])).values()],keys=new Set(chosen.map(lcOrderKey));
 for(const o of [...chosen,...(previous?.orders||[])])if(!w.shipments.some(s=>!s.confirmed&&!s.factoryNotice?.batchDeletedAt&&s.poNumber===o.po&&s.scNumber===o.sc))throw Error(o.po+' 沒有可編輯的出貨批次。');
 let next=w;
 for(const o of previous?.orders||[])if(!keys.has(lcOrderKey(o))){const current=w.shipments.filter(s=>!s.confirmed&&!s.factoryNotice?.batchDeletedAt&&s.poNumber===o.po&&s.scNumber===o.sc).flatMap(shipmentLcs);if(current.some(e=>e.number!==previous!.number))throw Error(o.po+' 的 L/C 已變更，請重新開啟編輯。');next=setOrderLc(next,rows,o.po,o.sc,'',{date:'',bank:'',replaceMultiple:true});}
 for(const o of chosen)next=setOrderLc(next,rows,o.po,o.sc,number,{date:entry.date,bank:entry.bank.trim(),replaceMultiple:true});
 const related=[...new Map(next.shipments.filter(s=>!s.confirmed&&!s.factoryNotice?.batchDeletedAt&&shipmentLcs(s).some(e=>e.number===number)).map(s=>[lcOrderKey({po:s.poNumber,sc:s.scNumber}),{po:s.poNumber,sc:s.scNumber}])).values()];
 for(const o of related)next=setOrderLc(next,rows,o.po,o.sc,number,{date:entry.date,bank:entry.bank.trim()});
 return next;
}

