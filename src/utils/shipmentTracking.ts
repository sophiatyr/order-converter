import {trackingFactoryCode} from './shipmentFactorySearch';
import ExcelJS from 'exceljs';
import type {TrackingRecord,Workspace} from './workspace';
import {shipmentQuantity} from './workspace';
import {localToday} from './trackingAutomation';
import type {OrderData} from '../types/order';
import {shipmentEstimates} from './shippingWorkflow';
export const shipmentTrackingHeaders=['Order          Date.','S/C NO.','PO','ITEM NO.',"Q'ty",'THE ORIGINAL DELIVERY WE CONFIRMED','FM','PRODUCTION SITUATION','THE ESTIMATED FACTORY FINISHED GOODS DATE','CTN','G.W.','CBM','Remark','L/C'];
export const shipmentTrackingColumns=[0,1,2,3,4,5,8,9,10,11,12,13];
export const shipmentTrackingLabels=['下單日','S/C','PO 編號','品號','訂單數量','原確認交期','預估完成日','箱數','毛重 kg','材積 m³','備註（工廠代碼）','L/C'];
export const shipmentTrackingFields:Record<number,string>={5:'shipmentOriginalDate',6:'shipmentEstimatedDate',7:'shipmentCartons',8:'shipmentGrossWeight',9:'shipmentCbm',11:'shipmentLc'};
export const shipmentTrackingKey=(r:TrackingRecord)=>JSON.stringify([r.scNumber,r.poNumber,r.itemNo]);
const orderColors=['FF156082','FF7030A0','FF196B24','FF9C3D10'];
export interface ShipmentTrackingTemplate {version:1;widths:number[];headers:string[];headerStyles:Partial<ExcelJS.Style>[];bodyStyles:Partial<ExcelJS.Style>[];headerHeight:number;bodyHeight:number;from:string;to:string;shipTo:string}
export async function loadShipmentTrackingTemplate(){const response=await fetch(`${import.meta.env.BASE_URL}csq-shipment-template.json`,{cache:'no-store'});if(!response.ok)throw new Error('客人 Order Tracking 範本未建立，請更新 CSQ 參考資料。');return await response.json() as ShipmentTrackingTemplate;}
export function shipmentTrackingData(rows:TrackingRecord[],w:Workspace,referenceOrders:OrderData[]=[]){
 return rows.map(r=>{
  const b=r.bulk||{},f=r.internalFields||{},variant=r.itemNo.match(/^(.+)-(XS|S|M|L|XL|XXL|XXXL)$/),sku=variant?.[1]||r.itemNo;
  const lines=w.shipments.filter(s=>s.confirmed&&s.poNumber===r.poNumber&&s.scNumber===r.scNumber).flatMap(s=>s.lines).filter(l=>l.itemNo===sku||l.itemNo===r.itemNo).filter(l=>shipmentQuantity(l)>0);
  const qty=lines.reduce((n,l)=>n+(variant&&l.itemNo===sku?l.sizes[variant[2]]||0:shipmentQuantity(l)),0),status=qty>=r.quantity&&qty>0?'SHIPPED':qty>0?'PARTIALLY SHIPPED':Object.entries(b).some(([k,v])=>k.endsWith('Status')&&v==='WAITING CISALFA')?'WAITING CUSTOMER APPROVAL':b.packingStatus==='COMPLETED'&&b.inspectionStatus==='COMPLETED'?'READY FOR SHIPMENT':b.packingStatus==='STARTED'?'PACKING':b.sewingStatus==='STARTED'?'SEWING':b.cuttingStatus==='STARTED'?'CUTTING':'';
  const pending=w.shipments.filter(s=>!s.factoryNotice?.batchDeletedAt&&!s.confirmed&&s.poNumber===r.poNumber&&s.scNumber===r.scNumber),estimates=pending.flatMap(s=>shipmentEstimates(s).filter(e=>{const l=s.lines.find(l=>l.id===e.lineId);return l&&(l.itemNo===r.itemNo||l.itemNo===sku);}));
  const poDate=[...w.orders,...referenceOrders].find(o=>o.poNumber===r.poNumber&&o.piNumber===r.scNumber)?.poDate||(date(f.R||'') instanceof Date?f.R:'');
  return {record:r,metricsKey:JSON.stringify([r.poNumber,r.scNumber,sku]),values:[poDate,r.scNumber,r.poNumber,r.itemNo,r.quantity,b.shipmentOriginalDate??r.customerDate,b.shipmentFm||'',qty>0?(status==='PARTIALLY SHIPPED'?`${status} (${qty}/${r.quantity})`:status):b.shipmentSituation||status,b.shipmentEstimatedDate||'',lines.length?lines.reduce((n,l)=>n+l.cartons,0):b.shipmentCartons!==undefined?(b.shipmentCartons===''?'':Number(b.shipmentCartons)):estimates.length?estimates.reduce((n,e)=>n+e.cartons,0):'',lines.length?lines.reduce((n,l)=>n+l.grossWeight,0):b.shipmentGrossWeight!==undefined?(b.shipmentGrossWeight===''?'':Number(b.shipmentGrossWeight)):estimates.length?estimates.reduce((n,e)=>n+e.grossWeight,0):'',lines.length?lines.reduce((n,l)=>n+l.cbm,0):b.shipmentCbm!==undefined?(b.shipmentCbm===''?'':Number(b.shipmentCbm)):estimates.length?estimates.reduce((n,e)=>n+e.cbm,0):'',trackingFactoryCode(r,[...w.orders,...referenceOrders]),b.shipmentLc??pending.map(s=>s.factoryNotice?.lcNumber).find(Boolean)??''] as (string|number)[]};
 });
}
function date(value:string|number){if(typeof value!=='string')return value;const m=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/),iso=m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:value;const d=new Date(`${iso}T00:00:00Z`);return /^\d{4}-\d{2}-\d{2}$/.test(iso)&&!isNaN(+d)&&d.toISOString().slice(0,10)===iso?d:value;}
export function trackingDateText(v:string|number|Date):string {
 if(v instanceof Date)return v.toISOString().slice(0,10);
 const d=date(v);return d instanceof Date?d.toISOString().slice(0,10):String(v);
}
export function shipmentTrackingMetricsLocked(r:TrackingRecord,w:Workspace){const sku=r.itemNo.replace(/-(XS|S|M|L|XL|XXL|XXXL)$/,'');return w.shipments.some(s=>s.confirmed&&s.poNumber===r.poNumber&&s.scNumber===r.scNumber&&s.lines.some(l=>(l.itemNo===r.itemNo||l.itemNo===sku)&&shipmentQuantity(l)>0));}
export function shipmentTrackingVisibleData(rows:TrackingRecord[],w:Workspace,orders:OrderData[]=[]){return shipmentTrackingData(rows,w,orders).map(d=>({...d,values:shipmentTrackingColumns.map(i=>d.values[i])}));}
export function buildShipmentTracking(rows:TrackingRecord[],w:Workspace,template:ShipmentTrackingTemplate,options:{date?:string;to?:string;from?:string;shipTo?:string;referenceOrders?:OrderData[]}={}){
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('CSQ'),data=shipmentTrackingVisibleData(rows,w,options.referenceOrders);
 // OOXML width includes 5 px of cell padding; with the workbook Normal font this is 0.625 characters. Excel displays 20.
 sheet.properties.defaultRowHeight=20;sheet.columns=shipmentTrackingColumns.map(()=>({width:20.625}));
 sheet.mergeCells('A1:L1');sheet.getCell('A1').value="SPORTS KITE INTERNATIONAL CO., LTD.";sheet.getCell('A1').font={name:'Calibri',size:26,bold:true};sheet.getCell('A1').alignment={horizontal:'center',vertical:'middle'};sheet.getRow(1).height=40;
 for(const [range,value] of [['A3:H3',options.to??template.to],['A4:H4',options.from??template.from],['A6:L6',options.shipTo??template.shipTo]] as const){sheet.mergeCells(range);const c=sheet.getCell(range.split(':')[0]);c.value=value;c.font={name:/[\u3400-\u9fff]/.test(value)?'Microsoft JhengHei':'Calibri',size:14};c.alignment={vertical:'middle',wrapText:true};sheet.getRow(Number(c.row)).height=25;}
 sheet.mergeCells('I4:J4');sheet.getCell('I4').value=date(options.date||localToday());sheet.getCell('I4').numFmt='dd-mmm-yyyy';sheet.getCell('I4').font={name:'Calibri',size:16};
 sheet.getRow(7).height=Math.max(75,template.headerHeight);shipmentTrackingColumns.forEach((source,i)=>{const c=sheet.getCell(7,i+1);c.value=template.headers[source];c.style=structuredClone(template.headerStyles[source]);c.font={...c.font,name:'Calibri'};c.alignment={...c.alignment,wrapText:true,vertical:'middle',horizontal:'center'};});
 const colors=new Map<string,string>();for(const d of data){const key=JSON.stringify([d.record.scNumber,d.record.poNumber]);if(!colors.has(key))colors.set(key,orderColors[colors.size%orderColors.length]);}
 const seen=new Map<string,number[]>(),meta=book.addWorksheet('_CSQ',{state:'veryHidden'});meta.getCell('A1').value='CSQ-SHIPMENT-TRACKING-1';
 data.forEach((entry,i)=>{const row=sheet.getRow(i+8);row.height=20;entry.values.forEach((v,c)=>{const cell=row.getCell(c+1),source=shipmentTrackingColumns[c];cell.value=[0,5,6].includes(c)?date(v):v;cell.style=structuredClone(template.bodyStyles[source]);cell.font={...cell.font,name:/[\u3400-\u9fff]/.test(String(v))?'Microsoft JhengHei':'Calibri',size:12,bold:false,color:{argb:colors.get(JSON.stringify([entry.record.scNumber,entry.record.poNumber]))!}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:shipmentTrackingFields[c]&&(![7,8,9].includes(c)||!shipmentTrackingMetricsLocked(entry.record,w))?'FFFFF2CC':'FFFFFFFF'}};cell.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};if([0,5,6].includes(c))cell.numFmt='dd-mmm-yyyy';if(c===4||c===7)cell.numFmt='#,##0';if(c===8)cell.numFmt='#,##0.00';if(c===9)cell.numFmt='0.000';});
 meta.getCell(i+2,1).value=JSON.stringify({key:shipmentTrackingKey(entry.record),quantity:entry.record.quantity,values:entry.values.map((v,c)=>[0,5,6].includes(c)?trackingDateText(v):String(v))});
 seen.set(entry.metricsKey,[...(seen.get(entry.metricsKey)||[]),i+8]);});
 for(const positions of seen.values())if(positions.length>1)for(const col of [8,9,10]){for(const r of positions.slice(1))sheet.getCell(r,col).value=null;if(positions.at(-1)!-positions[0]+1===positions.length)sheet.mergeCells(positions[0],col,positions.at(-1)!,col);}
 const total=8+data.length;sheet.getRow(total).height=20;sheet.getCell(total,1).value='TOTAL';for(const c of ['E','H','I','J'])sheet.getCell(c+total).value={formula:'SUM('+c+'8:'+c+(total-1)+')',result:Array.from({length:data.length},(_,i)=>sheet.getCell(c+(i+8))).filter(cell=>cell.master.address===cell.address).reduce((n,cell)=>n+(typeof cell.value==='number'?cell.value:0),0)};
 sheet.views=[{state:'frozen',ySplit:7,xSplit:4,showGridLines:false}];sheet.autoFilter={from:'A7',to:'L'+(total-1)};sheet.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0,printArea:'A1:L'+total,printTitlesRow:'1:7'};
 return book;
}
