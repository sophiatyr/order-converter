import fs from 'node:fs';
import ExcelJS from 'exceljs';
const file='CSQ參考資料/出貨作業/Order Tracking/CSQ Shipment Order Tracking Sheet-2026.10.02.xlsx';
const book=new ExcelJS.Workbook();await book.xlsx.readFile(file);const s=book.getWorksheet('CSQ');
const cellText=value=>value&&typeof value==='object'&&'richText'in value?value.richText.map(r=>r.text).join(''):String(value||'');
const template={version:1,widths:Array.from({length:14},(_,i)=>s.getColumn(i+1).width||13.44),headers:Array.from({length:14},(_,i)=>String(s.getCell(7,i+1).value||'')),headerStyles:Array.from({length:14},(_,i)=>s.getCell(7,i+1).style),bodyStyles:Array.from({length:14},(_,i)=>s.getCell(8,i+1).style),headerHeight:s.getRow(7).height||70,bodyHeight:s.getRow(8).height||24,from:String(s.getCell('A4').value||'FROM: S.K.'),to:String(s.getCell('A3').value||'TO: CISALFA SPORT SPA.'),shipTo:String(s.getCell('A6').value||'SHIP TO:')};
template.from=cellText(s.getCell('A4').value);template.to=cellText(s.getCell('A3').value);template.shipTo=cellText(s.getCell('A6').value);
fs.writeFileSync('public/csq-shipment-template.json',JSON.stringify(template));
console.log('Prepared customer Shipment Order Tracking template (14 columns).');
