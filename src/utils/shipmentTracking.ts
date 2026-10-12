import ExcelJS from 'exceljs';
import type {TrackingRecord,Workspace} from './workspace';
import {shipmentQuantity} from './workspace';
import {localToday} from './trackingAutomation';
import type {OrderData} from '../types/order';
export const shipmentTrackingHeaders=['Order          Date.','S/C NO.','PO','ITEM NO.',"Q'ty",'THE ORIGINAL DELIVERY WE CONFIRMED','FM','PRODUCTION SITUATION','THE ESTIMATED FACTORY FINISHED GOODS DATE','CTN','G.W.','CBM','Remark','L/C'];
export interface ShipmentTrackingTemplate {version:1;widths:number[];headers:string[];headerStyles:Partial<ExcelJS.Style>[];bodyStyles:Partial<ExcelJS.Style>[];headerHeight:number;bodyHeight:number;from:string;to:string;shipTo:string}
export async function loadShipmentTrackingTemplate(){const response=await fetch(`${import.meta.env.BASE_URL}csq-shipment-template.json`,{cache:'no-store'});if(!response.ok)throw new Error('客人 Order Tracking 範本未建立，請更新 CSQ 參考資料。');return await response.json() as ShipmentTrackingTemplate;}
export function shipmentTrackingData(rows:TrackingRecord[],w:Workspace,referenceOrders:OrderData[]=[]){
 return rows.map(r=>{
  const b=r.bulk||{},f=r.internalFields||{},variant=r.itemNo.match(/^(.+)-(XS|S|M|L|XL|XXL|XXXL)$/),sku=variant?.[1]||r.itemNo;
  const lines=w.shipments.filter(s=>s.confirmed&&s.poNumber===r.poNumber&&s.scNumber===r.scNumber).flatMap(s=>s.lines).filter(l=>l.itemNo===sku||l.itemNo===r.itemNo).filter(l=>shipmentQuantity(l)>0);
  const qty=lines.reduce((n,l)=>n+(variant&&l.itemNo===sku?l.sizes[variant[2]]||0:shipmentQuantity(l)),0),status=qty>=r.quantity&&qty>0?'SHIPPED':qty>0?'PARTIALLY SHIPPED':Object.entries(b).some(([k,v])=>k.endsWith('Status')&&v==='WAITING CISALFA')?'WAITING CUSTOMER APPROVAL':b.packingStatus==='COMPLETED'&&b.inspectionStatus==='COMPLETED'?'READY FOR SHIPMENT':b.packingStatus==='STARTED'?'PACKING':b.sewingStatus==='STARTED'?'SEWING':b.cuttingStatus==='STARTED'?'CUTTING':'';
  const poDate=[...w.orders,...referenceOrders].find(o=>o.poNumber===r.poNumber&&o.piNumber===r.scNumber)?.poDate||(date(f.R||'') instanceof Date?f.R:'');
  return {record:r,metricsKey:JSON.stringify([r.poNumber,r.scNumber,sku]),values:[poDate,r.scNumber,r.poNumber,r.itemNo,r.quantity,b.shipmentOriginalDate||r.customerDate,b.shipmentFm||'',qty>0?(status==='PARTIALLY SHIPPED'?`${status} (${qty}/${r.quantity})`:status):b.shipmentSituation||status,b.shipmentEstimatedDate||r.factoryDate,lines.length?lines.reduce((n,l)=>n+l.cartons,0):'',lines.length?lines.reduce((n,l)=>n+l.grossWeight,0):'',lines.length?lines.reduce((n,l)=>n+l.cbm,0):'',b.shipmentRemark||r.supplierCode||r.supplier,b.shipmentLc||''] as (string|number)[]};
 });
}
function date(value:string|number){if(typeof value!=='string')return value;const m=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/),iso=m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:value;const d=new Date(`${iso}T00:00:00Z`);return /^\d{4}-\d{2}-\d{2}$/.test(iso)&&!isNaN(+d)&&d.toISOString().slice(0,10)===iso?d:value;}
export function buildShipmentTracking(rows:TrackingRecord[],w:Workspace,template:ShipmentTrackingTemplate,options:{date?:string;to?:string;from?:string;shipTo?:string;referenceOrders?:OrderData[]}={}){
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('CSQ'),data=shipmentTrackingData(rows,w,options.referenceOrders);
 sheet.columns=template.widths.map(width=>({width}));
 sheet.mergeCells('A1:N1');sheet.getCell('A1').value="SPORTS KITE INT'L CO., LTD.";sheet.getCell('A1').font={name:'Calibri',size:26,bold:true};sheet.getCell('A1').alignment={horizontal:'center',vertical:'middle'};sheet.getRow(1).height=40;
 for(const [range,value] of [['A3:I3',options.to??template.to],['A4:I4',options.from??template.from],['A6:N6',options.shipTo??template.shipTo]] as const){sheet.mergeCells(range);const c=sheet.getCell(range.split(':')[0]);c.value=value;c.font={name:/[\u3400-\u9fff]/.test(value)?'Microsoft JhengHei':'Calibri',size:14};c.alignment={vertical:'middle',wrapText:true};sheet.getRow(Number(c.row)).height=25;}
 sheet.mergeCells('J4:K4');sheet.getCell('J4').value=date(options.date||localToday());sheet.getCell('J4').numFmt='dd-mmm-yyyy';sheet.getCell('J4').font={name:'Calibri',size:16};
 sheet.getRow(7).height=Math.max(75,template.headerHeight);template.headers.forEach((h,i)=>{const c=sheet.getCell(7,i+1);c.value=h;c.style=structuredClone(template.headerStyles[i]);c.font={...c.font,name:'Calibri'};c.alignment={...c.alignment,wrapText:true,vertical:'middle',horizontal:'center'};});
 const seen=new Map<string,number[]>();
 data.forEach((entry,i)=>{const row=sheet.getRow(i+8);row.height=Math.max(template.bodyHeight,32);entry.values.forEach((v,c)=>{const cell=row.getCell(c+1);cell.value=[0,5,8].includes(c)?date(v):v;cell.style=structuredClone(template.bodyStyles[c]);cell.font={...cell.font,name:/[\u3400-\u9fff]/.test(String(v))?'Microsoft JhengHei':'Calibri',size:12,bold:false,color:{argb:'FF000000'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFFFFF'}};cell.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};if([0,5,8].includes(c))cell.numFmt='dd-mmm-yyyy';if(c===4||c===9)cell.numFmt='#,##0';if(c===10)cell.numFmt='#,##0.00';if(c===11)cell.numFmt='0.000';});seen.set(entry.metricsKey,[...(seen.get(entry.metricsKey)||[]),i+8]);});
 // Shared carton/weight/CBM totals for size-suffixed sock styles are displayed once.
 for(const positions of seen.values())if(positions.length>1)for(const col of [10,11,12]){for(const r of positions.slice(1))sheet.getCell(r,col).value=null;if(positions.at(-1)!-positions[0]+1===positions.length)sheet.mergeCells(positions[0],col,positions.at(-1)!,col);}
 sheet.views=[{state:'frozen',ySplit:7,xSplit:4,showGridLines:false}];sheet.autoFilter={from:'A7',to:`N${Math.max(7,sheet.rowCount)}`};sheet.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0,printArea:`A1:N${Math.max(7,sheet.rowCount)}`,printTitlesRow:'1:7'};
 return book;
}
