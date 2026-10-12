import fs from 'node:fs';
import ExcelJS from 'exceljs';
const root='CSQ參考資料/出貨作業';
const sources={invoice:[`${root}/Invoice/CS251428FA-1(25OF037927)-IN.xlsx`,'INVOICE',20,[21,22,23,49],52,79],packing:[`${root}/Packing List +Weight/CS251428FA-1(25OF037927)-PK.xlsx`,'PK',15,[16,17,23,127],130,146],weight:[`${root}/Packing List +Weight/CS26001262-WEIGHT LIST.xlsx`,'WEIGHT LIST',10,[12,13,14,15,17],20,32]};
const out={version:1};
for(const [kind,[file,sheet,header,patterns,tailStart,tailEnd]] of Object.entries(sources)){
 const wb=new ExcelJS.Workbook();await wb.xlsx.readFile(file);const ws=wb.getWorksheet(sheet);
 const row=n=>({height:ws.getRow(n).height||18,cells:Array.from({length:kind==='packing'?18:kind==='invoice'?9:7},(_,i)=>({value:ws.getCell(n,i+1).value,style:ws.getCell(n,i+1).style}))});
 out[kind]={columns:Array.from({length:kind==='packing'?18:kind==='invoice'?9:7},(_,i)=>ws.getColumn(i+1).width||8.43),pageSetup:ws.pageSetup,margins:ws.pageSetup.margins,header:Array.from({length:header},(_,i)=>row(i+1)),patterns:patterns.map(row),tail:Array.from({length:tailEnd-tailStart+1},(_,i)=>row(tailStart+i))};
}
fs.writeFileSync('public/csq-shipping-documents.json',JSON.stringify(out));
console.log('Prepared original Invoice, Packing List and Weight List layouts.');
