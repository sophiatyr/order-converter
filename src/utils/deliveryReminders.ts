import type {TrackingRecord} from './workspace';
import {daysToFactory} from './trackingAutomation';
export type DeliveryLevel='red'|'yellow'|'later'|'unknown';
export interface DeliveryReminder {id:string;poNumber:string;scNumber:string;supplier:string;supplierName:string;date:string;days:number|null;level:DeliveryLevel;rows:TrackingRecord[];remaining:number;units:string;booked:boolean}
export const deliveryToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function deliveryReminders(rows:TrackingRecord[],today=deliveryToday()):DeliveryReminder[]{
 const groups=new Map<string,DeliveryReminder>();
 for(const row of rows){
  const shipped=Math.max(0,row.shippedQuantity||0);
  if(row.quantity<=0||row.status==='已出貨'||shipped>=row.quantity)continue;
  const date=(row.factoryDate||row.internalFields?.U||'').trim(),days=daysToFactory(date,today);
  const supplier=row.supplierCode||row.internalFields?.J||row.supplier||'待確認';
  const dateKey=days===null?date:String(days),id=JSON.stringify([row.poNumber,row.scNumber,supplier,dateKey,row.unit]);
  let group=groups.get(id);
  if(!group){group={id,poNumber:row.poNumber,scNumber:row.scNumber,supplier:row.supplier||supplier,supplierName:row.supplierName||row.internalFields?.K||'',date,days,level:days===null?'unknown':days<=10?'red':days<=30?'yellow':'later',rows:[],remaining:0,units:row.unit,booked:true};groups.set(id,group);}
  group.rows.push(row);group.remaining+=Math.max(0,row.quantity-shipped);group.booked=group.booked&&row.bulk?.bookingStatus==='BOOKED';
 }
 return [...groups.values()].sort((a,b)=>(a.days??Infinity)-(b.days??Infinity)||a.poNumber.localeCompare(b.poNumber,'en',{numeric:true})||a.supplier.localeCompare(b.supplier));
}
