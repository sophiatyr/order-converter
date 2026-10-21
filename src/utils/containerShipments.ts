import type {OrderData} from '../types/order';
import {newShipment,shipmentQuantity,type Shipment,type Workspace} from './workspace';
export const containerBatchKey=(s:Shipment)=>s.factoryNotice?.containerBatchId||s.id;
export const containerMembers=(s:Shipment,all:Shipment[])=>all.filter(x=>containerBatchKey(x)===containerBatchKey(s));
export function remainingSizes(o:OrderData,line:Shipment['lines'][number],all:Shipment[],currentId:string){
 const source=newShipment(o,'source').lines.find(l=>l.id===line.id);
 const item=o.items.find(i=>i.colors.some(c=>`${i.id}:${c.id}`===line.id));
 const color=item?.colors.find(c=>`${item.id}:${c.id}`===line.id);
 return Object.fromEntries(Object.keys(source?.sizes||line.sizes).map(size=>[size,Math.max(0,(color?.quantitiesBySize[size]||0)-all.filter(s=>s.id!==currentId&&s.confirmed&&s.poNumber===o.poNumber&&s.scNumber===o.piNumber).flatMap(s=>s.lines).filter(l=>l.itemNo===line.itemNo&&l.color===line.color).reduce((n,l)=>n+(l.sizes[size]||0),0))]));
}
export function createContainerOrders(orders:OrderData[],all:Shipment[],id:()=>string,anchor?:Shipment):Shipment[]{
 const group=anchor?containerBatchKey(anchor):id();
 return orders.map(o=>{
  const s=newShipment(o,id());
  const lines=s.lines.map(l=>({...l,planned:Object.values(remainingSizes(o,l,all,s.id)).reduce((a,b)=>a+b,0)})).filter(l=>l.planned>0);
  const selection=Object.fromEntries(lines.map(l=>[l.id,remainingSizes(o,l,all,s.id)]));
  return {...s,lines,...(anchor?{vessel:anchor.vessel,container:anchor.container,fromPort:anchor.fromPort,toPort:anchor.toPort}:{}),factoryNotice:{...Object.fromEntries(Object.entries(anchor?.factoryNotice||{}).filter(([k])=>['containerType','etd','eta','closingDate','deliveryToForwarder','bookingConfirmed','incoterms','consignee','notify','forwarder','batchName'].includes(k))),containerBatchId:group,originalPoAmount:String(o.totalAmountUSD),plannedSelection:JSON.stringify(selection)}};
 });
}
export function changeContainerSelection(s:Shipment,o:OrderData,all:Shipment[],lineId:string,selected:Record<string,number>|null):Shipment{
 if(s.confirmed)throw Error('已完成的出貨不可修改。');
 const source=newShipment(o,'source').lines.find(l=>l.id===lineId);if(!source)throw Error('款色不在原始 PO。');
 const current=s.lines.find(l=>l.id===lineId),remaining=remainingSizes(o,source,all,s.id);
 if(selected&&(Object.keys(selected).some(k=>!(k in remaining))||Object.values(selected).some(q=>!Number.isInteger(q)||q<0)||Object.entries(selected).some(([k,q])=>q>remaining[k])))throw Error('本次出貨數量須為非負整數，且不能超過 PO 未出貨數量。');
 if(current&&shipmentQuantity(current)>0&&(!selected||Object.entries(current.sizes).some(([k,q])=>q>(selected[k]||0))))throw Error('已填裝箱數量超過本次選取量，請先調整正式裝箱明細。');
 const selection=s.factoryNotice?.plannedSelection?JSON.parse(s.factoryNotice.plannedSelection):Object.fromEntries(s.lines.map(l=>[l.id,remainingSizes(o,l,all,s.id)]));
 if(selected)selection[lineId]=selected;else delete selection[lineId];
 const next=selected?{...(current||source),planned:Object.values(selected).reduce((a,b)=>a+b,0)}:null;
 const lines=next?current?s.lines.map(l=>l.id===lineId?next:l):[...s.lines,next]:s.lines.filter(l=>l.id!==lineId);
 if(!selected&&s.factoryNotice?.lcEntries){s={...s,factoryNotice:{...s.factoryNotice,lcEntries:JSON.stringify(JSON.parse(s.factoryNotice.lcEntries).map((e:{lineIds:string[]})=>({...e,lineIds:e.lineIds.filter(id=>id!==lineId)})))}};}
 const estimates=JSON.parse(s.factoryNotice?.estimateLines||'[]').filter((e:{lineId:string})=>lines.some(l=>l.id===e.lineId));
 return {...s,lines,factoryNotice:{...s.factoryNotice,plannedSelection:JSON.stringify(selection),estimateLines:JSON.stringify(estimates),formalPackingReviewed:'',customerDocumentsExported:''}};
}
export function updateContainerCommon(w:Workspace,s:Shipment,key:string,value:string,meta=false):Workspace{
 const ids=new Set(containerMembers(s,w.shipments).filter(x=>!x.confirmed).map(x=>x.id));
 return {...w,shipments:w.shipments.map(x=>!ids.has(x.id)?x:meta?{...x,factoryNotice:{...x.factoryNotice,[key]:value,customerDocumentsExported:''}}:{...x,[key]:value,factoryNotice:{...x.factoryNotice,customerDocumentsExported:''}})};
}
export function deleteContainerBatch(w:Workspace,s:Shipment,at=new Date().toISOString()):Workspace{
 const ids=new Set(containerMembers(s,w.shipments).map(x=>x.id));
 return {...w,shipments:w.shipments.map(x=>ids.has(x.id)?{...x,factoryNotice:{...x.factoryNotice,batchDeletedAt:at}}:x)};
}
export function restoreContainerBatch(w:Workspace,s:Shipment):Workspace{
 const ids=new Set(containerMembers(s,w.shipments).map(x=>x.id));
 return {...w,shipments:w.shipments.map(x=>ids.has(x.id)?{...x,factoryNotice:{...x.factoryNotice,batchDeletedAt:''}}:x)};
}

