import * as OpenCC from 'opencc-js/cn2t';
import type ExcelJS from 'exceljs';
import type {OrderData} from '../types/order';
export const traditional=OpenCC.Converter({from:'cn',to:'tw'});
export const COMPANY_ENGLISH="SPORTS KITE INT'L CO., LTD.";
export function fabricOnly(value:string){return value.replace(/^.*?Products?\s+compo(?:sition|tion)\s*[:：]\s*/i,'').trim();}
export function fabricLines(value:string){return fabricOnly(value).split(/\n+|(?=(?:主布|配布|內裡|内里|裏布|裡布|袖布|羅紋|罗纹|BODY|LINING|SLEEVE)\s*[:：])/i).map(s=>s.trim()).filter(Boolean);}
export const packingChinese=(o:OrderData,detail=false)=>o.packingType==='MULTIPLE PACK'?(detail?'單色混碼裝':'混碼包裝'):(detail?'單色單碼裝':'單碼包裝');
export function piShipment(o:OrderData){return `BEFORE ${o.shipmentDate.replace(/^\s*(BEFORE\s*)+/i,'').trim()}`;}
export function piTrade(o:OrderData){const port=o.port.trim()||o.tradeTerms.match(/\bFOB\s+(.+?)(?=\s+BY\b|$)/i)?.[1]?.trim()||'XIAMEN';const mode=/AIR/i.test(o.modeOfDelivery||o.tradeTerms)?'AIR':'SEA';return `FOB ${port.toUpperCase()} BY ${mode}`;}
export function formatDocumentText(book:ExcelJS.Workbook){for(const ws of book.worksheets)ws.eachRow(row=>row.eachCell(cell=>{if(cell.isMerged&&cell.master.address!==cell.address)return;if(typeof cell.value==='string'){let value=traditional(cell.value);value=value.replace(/SPORTS KITE INTERNATIONAL CO\.,?\s*LTD\.?|G\.K\. SPORTS INTER(?:N)?ATIONAL CO\.,?\s*LTD\.?/gi,COMPANY_ENGLISH);cell.value=value;}}));}
export function closeOuterBorder(ws:ExcelJS.Worksheet,lastRow:number,lastCol:number){
 const edge={style:'thin' as const,color:{argb:'FF000000'}};
 const merges=ws.model.merges||[];
 for(let r=1;r<=lastRow;r++)for(const c of [1,lastCol]){const cell=ws.getCell(r,c);cell.border={...cell.border,[c===1?'left':'right']:edge};if(cell.isMerged){const master=cell.master,range=merges.find(m=>m.split(':')[0]===master.address);if(range){const end=ws.getCell(range.split(':')[1]);if(c===lastCol&&Number(end.col)===lastCol)master.border={...master.border,right:edge};if(c===1&&Number(master.col)===1)master.border={...master.border,left:edge};}}}
 for(let c=1;c<=lastCol;c++){const top=ws.getCell(1,c),bottom=ws.getCell(lastRow,c);top.border={...top.border,top:edge};bottom.border={...bottom.border,bottom:edge};}
}
