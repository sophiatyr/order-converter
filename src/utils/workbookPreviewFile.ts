import * as XLSX from 'xlsx';
export interface WorkbookPreviewFile {bytes:Uint8Array;workbook:XLSX.WorkBook}
export interface NativeWorkbookPreview {name:string;values:(string|number|boolean|null)[][];formats:string[];merges:string[];styles:Record<string,{fill:string;color:string}>}
/** Native Excel supplies the displayed values when the original file is rights-protected. */
export function nativePreviewWorkbook(data:NativeWorkbookPreview):XLSX.WorkBook{
 const sheet=XLSX.utils.aoa_to_sheet(data.values);
 sheet['!merges']=data.merges.map(ref=>XLSX.utils.decode_range(ref));
 for(let r=0;r<data.values.length;r++)for(let c=0;c<data.values[r].length;c++){
  const address=XLSX.utils.encode_cell({r,c}),cell=sheet[address];if(!cell)continue;
  if(r>=5&&data.formats[c]){cell.z=data.formats[c];cell.w=XLSX.utils.format_cell(cell);}
  const style=data.styles[address]||data.styles[XLSX.utils.encode_cell({r:5,c})];
  if(style)cell.s={fgColor:{rgb:style.fill},fontColor:style.color};
 }
 return {SheetNames:[data.name],Sheets:{[data.name]:sheet}};
}
