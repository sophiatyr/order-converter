import type {Shipment} from './workspace';
export interface ShipmentLc {number:string;date:string;bank:string;lineIds:string[]}
export function shipmentLcs(s:Shipment):ShipmentLc[]{
 if(s.factoryNotice?.lcEntries){const entries=JSON.parse(s.factoryNotice.lcEntries);if(!Array.isArray(entries)||entries.some(e=>typeof e.number!=='string'||typeof e.date!=='string'||typeof e.bank!=='string'||!Array.isArray(e.lineIds)||e.lineIds.some((id:unknown)=>typeof id!=='string')))throw Error('L/C 對應資料格式不符');return entries;}
 return s.factoryNotice?.lcNumber?[{number:s.factoryNotice.lcNumber,date:s.factoryNotice.lcIssueDate||'',bank:s.factoryNotice.lcIssueBank||'',lineIds:s.lines.map(l=>l.id)}]:[];
}
export function lcForLine(s:Shipment,lineId:string){const entries=shipmentLcs(s).filter(e=>e.number.trim()),matches=entries.filter(e=>e.lineIds.includes(lineId));if(matches.length>1||entries.length>0&&matches.length!==1)throw Error('請逐款色確認 L/C 對應，每款色應對應一張 L/C。');return matches[0]?.number||'';}
export function withShipmentLcs(s:Shipment,entries:ShipmentLc[]):Shipment{
 if(s.confirmed)throw Error('已確認出貨不可更改 L/C。');
 if(entries.some(e=>e.lineIds.some(id=>!s.lines.some(l=>l.id===id))))throw Error('L/C 對應款色不在本次出貨。');
 return {...s,factoryNotice:{...s.factoryNotice,lcEntries:JSON.stringify(entries),lcNumber:entries.map(e=>e.number.trim()).filter(Boolean).join(' / '),lcIssueDate:entries.filter(e=>e.number.trim()).map(e=>`${e.number}: ${e.date}`).join('\n'),lcIssueBank:entries.filter(e=>e.number.trim()).map(e=>`${e.number}: ${e.bank}`).join('\n'),customerDocumentsExported:''}};
}
