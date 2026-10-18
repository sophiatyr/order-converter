import * as OpenCC from 'opencc-js/cn2t';
import type ExcelJS from 'exceljs';
import type {OrderData} from '../types/order';
import {normalizeClassification} from './classification';
export function piFilename(order:OrderData){
 const o=normalizeClassification(order);
 const title=[o.series?.trim()||o.brand?.trim(),o.season?.trim()].filter(Boolean).join(' ');
 return `${o.piNumber}(${o.poNumber})${title?'-'+title:''}`.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/[. ]+$/,'')+'.xlsx';
}
export function factoryFilename(order:OrderData){
 const o=normalizeClassification(order),date=o.poDate.trim();
 const iso=date.match(/^\d{4}[-/.年](\d{1,2})[-/.月]\d{1,2}/),dayFirst=date.match(/^\d{1,2}[/.](\d{1,2})[/.]\d{4}$/);
 const month=Number((iso||dayFirst)?.[1]);
 if(!Number.isInteger(month)||month<1||month>12)throw new Error('請確認訂單日期，採購單檔名需要下單月份。');
 const title=[o.series?.trim()||o.brand?.trim(),o.season?.trim()].filter(Boolean).join(' ');
 return `${String(month).padStart(2,'0')}-${o.piNumber}-PO正-${o.supplierCode}${title?'('+title+')':''}`.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/[. ]+$/,'')+'.xlsx';
}
export const traditional=OpenCC.Converter({from:'cn',to:'tw'});
export const COMPANY_ENGLISH="SPORTS KITE INTERNATIONAL CO., LTD.";
export function fabricOnly(value:string){return value.replace(/^.*?Products?\s+compo(?:sition|tion)\s*[:：]\s*/i,'').trim();}
export function fabricLines(value:string){return fabricOnly(value).split(/\n+|(?=(?:主布|配布|內裡|内里|裏布|裡布|袖布|羅紋|罗纹|BODY|LINING|SLEEVE)\s*[:：])/i).map(s=>s.trim()).filter(Boolean);}
export const packingChinese=(o:OrderData,detail=false)=>o.packingType==='MULTIPLE PACK'?(detail?'單色混碼裝':'混碼包裝'):(detail?'單色單碼裝':'單碼包裝');
export function piShipment(o:OrderData){
 const value=o.shipmentDate.replace(/^\s*(BEFORE\s*)+/i,'').trim();
 const iso=value.match(/^(\d{4})-(\d{2})-(\d{2})$/),dayFirst=value.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
 const match=iso||dayFirst;
 if(!match)return `BEFORE ${value}`;
 const year=Number(iso?match[1]:match[3]),month=Number(match[2]),day=Number(iso?match[3]:match[1]);
 const date=new Date(Date.UTC(year,month-1,day));
 if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return `BEFORE ${value}`;
 const months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
 return `BEFORE ${months[month-1]}, ${day}. ${year}.`;
}
export function piTrade(o:OrderData){const port=o.port.trim()||o.tradeTerms.match(/\bFOB\s+(.+?)(?=\s+BY\b|$)/i)?.[1]?.trim()||'XIAMEN';const mode=/AIR/i.test(o.modeOfDelivery||o.tradeTerms)?'AIR':'SEA';return `FOB ${port.toUpperCase()} BY ${mode}`;}
export function factoryDeadline(value:string){
 const iso=value.match(/^(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})(?:日|$)/),dayFirst=value.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
 const match=iso||dayFirst;if(!match)return value;
 const year=iso?match[1]:match[3],month=match[2],day=iso?match[3]:match[1];
 const date=new Date(Date.UTC(Number(year),Number(month)-1,Number(day)));
 if(date.getUTCMonth()!==Number(month)-1||date.getUTCDate()!==Number(day))return value;
 return `${year}年${month.padStart(2,'0')}月${day.padStart(2,'0')}日前 (交期不能延誤!!)`;
}
export function factoryTrade(o:OrderData){
 const terms=(o.factoryTradeTerms??o.tradeTerms).trim().replace(/F\.?O\.?B\.?/i,'FOB');
 if(/^FOB\b/i.test(terms)&&(/\bXIAMEN\b/i.test(terms)||/^FOB(?:\s+BY\s+(?:SEA|AIR))?$/i.test(terms)&&/^XIAMEN$/i.test(o.port.trim())))return 'FOB廈門';
 return terms.replace(/^FOB\s+(廈門|厦门|上海)/i,(_,port)=>`FOB${traditional(port)}`);
}
export function formatDocumentText(book:ExcelJS.Workbook){for(const ws of book.worksheets)ws.eachRow(row=>row.eachCell(cell=>{if(cell.isMerged&&cell.master.address!==cell.address)return;if(typeof cell.value==='string'){let value=traditional(cell.value);value=value.replace(/SPORTS KITE (?:INTERNATIONAL|INT['’]L) CO\.,?\s*LTD\.?|G\.K\. SPORTS INTER(?:N)?ATIONAL CO\.,?\s*LTD\.?/gi,COMPANY_ENGLISH);cell.value=value;}}));}
export function closeOuterBorder(ws:ExcelJS.Worksheet,lastRow:number,lastCol:number){
 const edge={style:'thin' as const,color:{argb:'FF000000'}};
 const merges=ws.model.merges||[];
 for(let r=1;r<=lastRow;r++)for(const c of [1,lastCol]){const cell=ws.getCell(r,c);cell.border={...cell.border,[c===1?'left':'right']:edge};if(cell.isMerged){const master=cell.master,range=merges.find(m=>m.split(':')[0]===master.address);if(range){const end=ws.getCell(range.split(':')[1]);if(c===lastCol&&Number(end.col)===lastCol)master.border={...master.border,right:edge};if(c===1&&Number(master.col)===1)master.border={...master.border,left:edge};}}}
 for(let c=1;c<=lastCol;c++){const top=ws.getCell(1,c),bottom=ws.getCell(lastRow,c);top.border={...top.border,top:edge};bottom.border={...bottom.border,bottom:edge};}
}
