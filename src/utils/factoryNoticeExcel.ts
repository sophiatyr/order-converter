import ExcelJS from 'exceljs';
import {factoryNoticeContent,type FactoryNoticeData,type FactoryNoticeTemplate} from './factoryNotice';
import {shippingCompany} from './shippingWorkflow';
import {saveWorkbookToFile} from './excelExport';
export function factoryNoticeWorkbook(g:FactoryNoticeData,t:FactoryNoticeTemplate){
 if(g.lines.some(l=>l.description==='待確認出貨品名'))throw Error('請先確認各 PO / 款式的出貨品名。');

 const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('工廠出貨通知書'),c=factoryNoticeContent(g,t);
 ws.columns=[{width:23},{width:30},{width:32},{width:23}];
 const full=(value:string,height=24)=>{const row=ws.addRow([value]);ws.mergeCells(row.number,1,row.number,4);row.height=height;return row;};
 full(shippingCompany.name,28).font={name:'Aptos',size:15,bold:true};full(shippingCompany.address,32);full(shippingCompany.contact,26);full('工廠出貨通知書 / SHIPPING NOTICE',30).font={name:'Aptos',size:14,bold:true};
 full(c.to);full(c.date);full(c.from);full(c.re);
 for(const [label,value]of [['SHIPPER',c.shipper],['CONSIGNEE',c.consignee],['NOTIFY',c.notify],['FORWARDER',c.forwarder],['SHIPPING MARKS',c.marks],['DESCRIPTION',c.description],['ROUTE',c.route.join('\n')],['SCHEDULE',c.schedule],['VESSEL',c.vessel],['PAYMENT',c.payment+' / '+c.freight]]){const row=ws.addRow([label,value]);ws.mergeCells(row.number,2,row.number,4);row.height=Math.max(32,Math.ceil(value.length/65)*16,value.split('\n').length*16);row.getCell(1).font={name:'Aptos',size:10,bold:true};}
 ws.addRow(['S/C / PO','ITEM','DESCRIPTION','QUANTITY']);const begin=ws.rowCount+1;
 for(const l of g.lines){const row=ws.addRow([`${l.sc}\n${l.po}`,l.sku,l.description,l.quantity]);row.height=Math.max(32,Math.ceil(l.description.length/30)*15);row.getCell(4).numFmt='#,##0" '+l.unit+'"';}
 const total=ws.addRow(['TOTAL','','',{formula:`SUM(D${begin}:D${ws.rowCount})`,result:g.lines.reduce((n,l)=>n+l.quantity,0)}]);total.height=24;total.getCell(4).numFmt='#,##0';full(c.total);full(c.remarks,Math.max(40,c.remarks.split('\n').length*17));if(c.agent)full(c.agent,60);
 ws.eachRow(row=>row.eachCell(cell=>{cell.font={name:'Aptos',size:10,...cell.font};cell.alignment={vertical:'middle',wrapText:true};cell.border={bottom:{style:'hair',color:{argb:'FFB8C4C5'}}};}));
 ws.pageSetup={paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.5,right:.4,top:.4,bottom:.4,header:.2,footer:.2}};
 wb.calcProperties.fullCalcOnLoad=true;return wb;
}
export function exportFactoryNoticeExcel(g:FactoryNoticeData,t:FactoryNoticeTemplate){return saveWorkbookToFile(factoryNoticeWorkbook(g,t),`工廠出貨通知_${g.code}_${g.fields.noticeDate||''}.xlsx`);}
