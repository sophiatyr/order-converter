import {buildCustomerBulk,buildInternalTracking} from './trackingDocuments';
import ExcelJS from 'exceljs';
import type {OrderData} from '../types/order';
import {saveWorkbookToFile} from './excelExport';
import {shipmentQuantity,type Shipment,type TrackingRecord,type Workspace,analytics} from './workspace';
import {buildShippingDocuments,loadShippingTemplates} from './shippingDocuments';
export function reportBook(title:string,headers:string[],rows:(string|number)[][]){
 const wb=new ExcelJS.Workbook();const ws=wb.addWorksheet(title.slice(0,31));
 ws.addRow([title]);ws.mergeCells(1,1,1,headers.length);ws.getRow(1).font={size:16,bold:true,color:{argb:'FF153C41'}};ws.addRow(headers);
 ws.getRow(2).font={bold:true,color:{argb:'FFFFFFFF'}};ws.getRow(2).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF256F63'}};
 rows.forEach(row=>ws.addRow(row));ws.views=[{state:'frozen',ySplit:2}];ws.autoFilter={from:{row:2,column:1},to:{row:2,column:headers.length}};
 ws.columns.forEach((c,index)=>{c.width=Math.min(45,Math.max(14,headers[index].length*2+4));});
 ws.eachRow(row=>{row.alignment={vertical:'middle',wrapText:true};row.eachCell(cell=>{if(typeof cell.value==='number')cell.numFmt='#,##0.###';});});
 ws.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0};return wb;
}
export function buildTracking(rows:TrackingRecord[],kind:string,orders:OrderData[]=[]){
 if(kind==='Bulk Status')return buildCustomerBulk(rows,orders);
 if(kind==='內部訂單追蹤'||kind==='訂單進度')return buildInternalTracking(rows);
 const heads=['SUPPLIER / FACTORY','BRAND','STYLE','PO NUMBER','ORDER COMPANY','ETD ON PO','ETD CONFIRMED','ORDER QUANTITY','UNIT','STATUS','FINAL TP','LAB DIP','FIT SAMPLE','PPS','FABRIC TEST DATE','FABRIC TEST STATUS','CUTTING','SEWING','SHIPPING SAMPLE','INSPECTION','PACKING','REMARK','SOURCE'];
 return reportBook(kind,heads,rows.map(r=>[r.supplier,r.brand,r.itemNo,r.poNumber,r.company,r.customerDate,r.factoryDate,r.quantity,r.unit,r.status,r.tp,r.labDip,r.fitSample,r.pps,r.fabricTestDate,r.fabricTestStatus,r.cutting,r.sewing,r.shippingSample,r.inspection,r.packing,r.remarks,r.source]));
}
export async function exportTracking(rows:TrackingRecord[],kind:string,orders:OrderData[]=[]){return saveWorkbookToFile(buildTracking(rows,kind,orders),`${kind}.xlsx`);}
export function buildShipment(s:Shipment,kind:'notice'|'packing'|'invoice'){
 const stamp=s.confirmed?'已確認':'草稿';const title=kind==='notice'?'出貨通知書':kind==='packing'?'Packing List + Weight':'Invoice';
 const lines=s.lines.filter(l=>shipmentQuantity(l)>0);
 const headers=kind==='packing'?['ITEM','COLOR','SIZE','QTY','UNIT','CTNS（款色合計）','N.W. KG（款色合計）','G.W. KG（款色合計）','CBM（款色合計）']:kind==='invoice'?['ITEM','DESCRIPTION','COLOR','QUANTITY','UNIT','UNIT PRICE USD','AMOUNT USD']:['FACTORY','ITEM','COLOR','QUANTITY','UNIT','CTNS','N.W. KG','G.W. KG','CBM'];
 const rows:(string|number)[][]=kind==='packing'?lines.flatMap(l=>Object.entries(l.sizes).filter(([,q])=>q>0).map(([size,q],index)=>[l.itemNo,l.color,size,q,l.unit,index===0?l.cartons:'',index===0?l.netWeight:'',index===0?l.grossWeight:'',index===0?l.cbm:''])):kind==='invoice'?lines.map(l=>[l.itemNo,l.description,l.color,shipmentQuantity(l),l.unit,l.unitPriceUSD,shipmentQuantity(l)*l.unitPriceUSD]):lines.map(l=>[l.supplier,l.itemNo,l.color,shipmentQuantity(l),l.unit,l.cartons,l.netWeight,l.grossWeight,l.cbm]);
 const wb=reportBook(`${title} (${stamp})`,headers,rows);const info=wb.addWorksheet('出貨資料');
 const document=wb.worksheets[0];
 if(kind==='invoice'){
  const total=document.addRow(['TOTAL USD','','','','','',lines.reduce((n,l)=>n+shipmentQuantity(l)*l.unitPriceUSD,0)]);total.font={bold:true};total.getCell(7).numFmt='#,##0.00';
 }else{
  const totals=document.addRow(kind==='packing'?['TOTAL','','','','',lines.reduce((n,l)=>n+l.cartons,0),lines.reduce((n,l)=>n+l.netWeight,0),lines.reduce((n,l)=>n+l.grossWeight,0),lines.reduce((n,l)=>n+l.cbm,0)]:['TOTAL','','','','',lines.reduce((n,l)=>n+l.cartons,0),lines.reduce((n,l)=>n+l.netWeight,0),lines.reduce((n,l)=>n+l.grossWeight,0),lines.reduce((n,l)=>n+l.cbm,0)]);totals.font={bold:true};
 }
 [['狀態',stamp],['Invoice',s.invoiceNo],['PO',s.poNumber],['SC',s.scNumber],['客戶',s.customer],['地址',s.address],['實際出貨日期',s.date],['船名',s.vessel],['櫃號',s.container],['起運港',s.fromPort],['目的港',s.toPort],['備註',s.remarks]].forEach(row=>info.addRow(row));info.columns=[{width:22},{width:80}];info.eachRow(r=>r.alignment={wrapText:true});
 if(kind==='notice')for(const supplier of [...new Set(lines.map(l=>l.supplier))]){const ws=wb.addWorksheet(`工廠通知 ${wb.worksheets.length}`);ws.addRows([['工廠',supplier],['PO',s.poNumber],['出貨日期',s.date],['船名',s.vessel],['櫃號',s.container],['備註',s.remarks],['品號','顏色','數量','單位'],...lines.filter(l=>l.supplier===supplier).map(l=>[l.itemNo,l.color,shipmentQuantity(l),l.unit])]);ws.columns=[{width:30},{width:45},{width:20},{width:20}];}
 return wb;
}
export async function exportShipment(s:Shipment,kind:'packing'|'invoice',order?:OrderData){return saveWorkbookToFile(buildShippingDocuments(s,kind,await loadShippingTemplates(),order),`${s.invoiceNo}_${kind}_${s.confirmed?'已確認':'草稿'}.xlsx`);}
export async function exportAnalytics(w:Workspace){const data=analytics(w);const wb=reportBook('季度下單分析',['季度 / 季別','日曆季度','客戶','訂單數','PO 數量','客戶金額 USD'],data.orders.map(r=>[r.season,r.quarter,r.customer,r.count,r.quantity,r.amount]));const shipped=reportBook('實際出貨業績',['季度 / 季別','日曆季度','客戶','出貨批次','數量','出貨金額 USD'],data.shipments.map(r=>[r.season,r.quarter,r.customer,r.count,r.quantity,r.amount]));const target=wb.addWorksheet('實際出貨業績');target.model={...shipped.worksheets[0].model,name:'實際出貨業績',id:target.id};return saveWorkbookToFile(wb,'CSQ_數據分析.xlsx');}
