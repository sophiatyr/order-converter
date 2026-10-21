import type {OrderData} from '../types/order';
import {shipmentQuantity,type Shipment,type Workspace,type TrackingRecord} from './workspace';
import {activeTrackingRows} from './trackingAutomation';
export const shippingCompany={name:'SPORTS KITE INTERNATIONAL CO., LTD.',address:'7 F., NO. 522, SEC. 5, ZHONGSHAN N. RD., SHILIN DIST., TAIPEI CITY 111005 TAIWAN',contact:'TEL : 886-2-2763-5455 (Rep.)  FAX: 886-2-2763-5177 www.sportskite.com.tw'};
export const shippingSteps=['待出貨追蹤','預估清單與 L/C','訂艙與工廠通知','正式裝箱核對','客戶文件','完成出貨'] as const;
export interface ShippingEstimate {lineId:string;quantity:number;cartons:number;grossWeight:number;cbm:number}
export function shipmentEstimates(s:Shipment):ShippingEstimate[]{try{const p=JSON.parse(s.factoryNotice?.estimateLines||'[]');return Array.isArray(p)?p.filter(e=>s.lines.some(l=>l.id===e.lineId)&&['quantity','cartons','grossWeight','cbm'].every(k=>Number.isFinite(e[k])&&e[k]>=0)):[];}catch{return [];}}
export function updateShippingLc(w:Workspace,s:Shipment,value:string,rows:TrackingRecord[]):Workspace{
 const tracking={...w.tracking};for(const r of rows.filter(r=>r.poNumber===s.poNumber&&r.scNumber===s.scNumber)){tracking[r.id]={...tracking[r.id],bulk:{...tracking[r.id]?.bulk,shipmentLc:value}};}
 return {...w,tracking,shipments:w.shipments.map(x=>x.id===s.id?{...x,factoryNotice:{...x.factoryNotice,lcNumber:value}}:x)};
}
export function pendingShipmentRows(rows:TrackingRecord[],completed=false){const active=activeTrackingRows(rows),ids=new Set(active.map(r=>r.id));return completed?rows.filter(r=>!ids.has(r.id)):active;}
const cents=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export function shippingInvoiceAmounts(s:Shipment,o:OrderData,w:Workspace){
 const gross=cents(s.lines.reduce((n,l)=>n+cents(shipmentQuantity(l)*l.unitPriceUSD),0)),company=(o.orderingCompany||o.customerName).toUpperCase(),medico=company.includes('MEDICO'),hasDeposit=medico||company.includes('PREMIUM');
 const original=Number(s.factoryNotice?.originalPoAmount||o.totalAmountUSD),depositTotal=hasDeposit?cents(original*.3):0;
 const used=cents(w.shipments.filter(x=>x.id!==s.id&&x.confirmed&&x.poNumber===s.poNumber&&x.scNumber===s.scNumber).reduce((n,x)=>n+Number(x.factoryNotice?.depositApplied||0),0));
 const available=Math.max(0,cents(depositTotal-used)),specified=s.factoryNotice?.depositApplied;
 const discount=medico?cents(gross*.01):0,deposit=hasDeposit?(specified!==undefined&&specified!==''?Number(specified):Math.min(available,cents(gross-discount))):0;
 if(!Number.isFinite(original)||original<0||!Number.isFinite(deposit)||deposit<0||deposit>available+.001)throw Error('訂金扣抵超過原始 PO 訂金餘額，請核對歷次出貨。');
 if(gross-deposit-discount<-.001)throw Error('本批訂金扣抵加折扣超過發票金額，請調整本批扣抵金額。');
 return {gross,original,depositTotal,depositUsed:used,depositAvailable:available,deposit,discount,net:cents(gross-deposit-discount)};
}
export function saveShipmentEstimate(w:Workspace,s:Shipment,estimates:ShippingEstimate[]):Workspace{
 if(s.confirmed)throw Error('已完成出貨不可修改預估資料。');
 if(s.factoryNotice?.plannedSelection){const selection=JSON.parse(s.factoryNotice.plannedSelection);if(estimates.some(e=>e.quantity>Object.values(selection[e.lineId]||{}).reduce<number>((n,q)=>n+Number(q),0)))throw Error('預估件數不可超過本次選取出貨數量。');}
 if(estimates.some(e=>!s.lines.some(l=>l.id===e.lineId)||!Number.isInteger(e.quantity)||!Number.isInteger(e.cartons)||['quantity','cartons','grossWeight','cbm'].some(k=>!Number.isFinite(e[k as keyof ShippingEstimate] as number)||Number(e[k as keyof ShippingEstimate])<0)))throw Error('預估件數、箱數、重量或材積不符。');
 return {...w,shipments:w.shipments.map(x=>x.id===s.id?{...x,factoryNotice:{...x.factoryNotice,estimateLines:JSON.stringify(estimates)}}:x)};
}
