import type ExcelJS from 'exceljs';
const han=/[\u3400-\u9fff\uf900-\ufaff]/;
export const documentFont=(value:string)=>han.test(value)?'Microsoft JhengHei':'Calibri';
export function presentWorkbook(book:ExcelJS.Workbook){
 for(const ws of book.worksheets){
  const limit=ws.columnCount;
  ws.eachRow({includeEmpty:true},row=>row.eachCell({includeEmpty:true},cell=>{
   if(cell.isMerged&&cell.master.address!==cell.address)return;
   const value=cell.value;const label=cell.text;
   cell.font={...cell.font,name:documentFont(label)};
   if(value instanceof Date&&(!cell.numFmt||cell.numFmt==='General'||cell.numFmt==='@'))cell.numFmt='yyyy-mm-dd';
   if(!label||typeof value==='number'||value instanceof Date||value&&typeof value==='object'&&'formula'in value)return;
   const column=Number(cell.col);let end=column;
   if(cell.isMerged){const merge=(ws.model.merges||[]).find(range=>{const [a]=range.split(':');return a===cell.address;});if(merge){const address=merge.split(':')[1];end=Number(ws.getCell(address).col);}}
   else if(!cell.border?.right){
    for(let col=column+1;col<=limit;col++){const next=row.getCell(col);if(next.value!==null||next.isMerged||next.border?.left)break;end=col;if(next.border?.right)break;}
    if(end>column)ws.mergeCells(row.number,column,row.number,end);
   }
   cell.alignment={...cell.alignment,wrapText:true,shrinkToFit:false};
   const fontSize=cell.font.size||11;
   const width=Array.from({length:end-column+1},(_,n)=>(ws.getColumn(column+n).width||8.43)*7+5).reduce((a,b)=>a+b,0)-6;
   const lines=label.split('\n').reduce((total,line)=>total+Math.max(1,Math.ceil([...line].reduce((sum,ch)=>sum+(han.test(ch)?1:.56)*fontSize*4/3,0)/Math.max(width,20))),0);
   // Let wrapped text expand the row instead of clipping it in Excel or preview.
   const masterSpan=(ws.model.merges||[]).find(range=>range.split(':')[0]===cell.address);
   const lastRow=masterSpan?ws.getCell(masterSpan.split(':')[1]).row:row.number;
   if(lastRow===row.number)row.height=Math.max(row.height||15,lines*fontSize*1.25+3);
   if(typeof value==='string'&&han.test(value)&&/[A-Za-z]/.test(value))cell.value={richText:(value.match(/[\u3400-\u9fff\uf900-\ufaff]+|[^\u3400-\u9fff\uf900-\ufaff]+/g)||[]).map(text=>({text,font:{...cell.font,name:documentFont(text)}}))};
   else if(value&&typeof value==='object'&&'richText'in value)cell.value={richText:value.richText.flatMap(run=>(run.text.match(/[\u3400-\u9fff\uf900-\ufaff]+|[^\u3400-\u9fff\uf900-\ufaff]+/g)||[]).map(text=>({text,font:{...cell.font,...run.font,name:documentFont(text)}})))};
  }));
  // Excel requires styled merged members to retain every edge of the merged range.
  for(const range of ws.model.merges||[]){const [start,end]=range.split(':');const master=ws.getCell(start),last=ws.getCell(end),style=JSON.parse(JSON.stringify(master.style));for(let r=Number(master.row);r<=Number(last.row);r++)for(let c=Number(master.col);c<=Number(last.col);c++)if(r!==Number(master.row)||c!==Number(master.col))ws.getCell(r,c).style=JSON.parse(JSON.stringify(style));}
 }
 return book;
}
