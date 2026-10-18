import {poComposition} from './orderComposition';
import {multiplePackRows} from './multiplePack';
import {withFactoryReferenceTerms} from './factoryReferenceTerms';
import {pricingCode,sizeVariantOrder,sizeLabel} from './sizeVariants';
import {colorChinese} from './colorText';
import {factoryText} from './factoryText';
import type {Workspace} from './workspace';
import {presentWorkbook} from './workbookPresentation';
import ExcelJS from 'exceljs';
import {orderedSizes} from './sizeOrder';
import {normalizeClassification} from './classification';
import {withErpPiMaterials} from './piMaterials';
import type {ErpSnapshot} from './erpProducts';
import type {OrderData,OrderItem,Colorway} from '../types/order';
import {factoryDocument,chineseFactoryName,normalizeCsqOrder} from './csqAccount';
import {findCsqReference,type CsqReference} from './csqReferences';
import {amountToEnglishWords,amountToChineseWords} from './numberToWords';
import {formatDocumentText,closeOuterBorder,fabricOnly,fabricLines,packingChinese,piShipment,piTrade,factoryDeadline,factoryTrade,COMPANY_ENGLISH} from './documentFormatting';
export type DocumentKind='pi'|'factory'|'quantity'|'overview';
interface LayoutCell {r:number;c:number;v:any;s:number}
interface LayoutSheet {name:string;rowCount:number;colCount:number;cells:LayoutCell[];merges:number[][];columns:{width:number;hidden:boolean}[];rows:{height:number;hidden:boolean}[];pageSetup:Partial<ExcelJS.PageSetup>;showGridLines:boolean}
export interface DocumentTemplate {kind:DocumentKind;file:string;scNumbers:string[];poNumbers:string[];itemNos:string[];factoryCodes:string[];packing:string;sheet:LayoutSheet}
export interface DocumentTemplates {version:number;updatedAt:string;styles:Partial<ExcelJS.Style>[];templates:DocumentTemplate[];warnings:{file:string;reason:string}[]}
export interface ReferenceWorkbook {book:ExcelJS.Workbook;sources:string[]}
export async function loadDocumentTemplates():Promise<DocumentTemplates>{const r=await fetch(`${import.meta.env.BASE_URL}csq-document-templates.json`,{cache:'no-store'});if(!r.ok)throw new Error('尚未建立文件範本，請更新 CSQ 參考資料。');const data=await r.json();if(data.version!==1||!Array.isArray(data.templates)||!data.templates.length)throw new Error('文件範本格式不符。');return data;}
const text=(v:any)=>typeof v==='string'?v:typeof v==='number'?String(v):'';
const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
const money=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
function pick(data:DocumentTemplates,kind:DocumentKind,o:OrderData,item?:OrderItem){
 const list=data.templates.filter(t=>t.kind===kind&&(kind!=='factory'||!o.supplierCode||t.factoryCodes.includes(o.supplierCode))&&(!item||t.itemNos.includes(item.itemNo)));
 const matching=list.length?list:data.templates.filter(t=>t.kind===kind&&(kind!=='factory'||t.factoryCodes.includes(o.supplierCode)));
 const candidates=matching.length||kind!=='factory'?matching:data.templates.filter(t=>t.kind==='factory');
 if(!candidates.length)throw new Error(`${kind==='factory'?`工廠 ${o.supplierCode}`:'文件'}沒有可用範本，請把對應 Excel 放入參考資料夾。`);
 return [...candidates].sort((a,b)=>score(b)-score(a))[0];
 function score(t:DocumentTemplate){return (t.scNumbers.includes(o.piNumber)?10000:0)+(t.poNumbers.includes(o.poNumber)?10000:0)+(item&&t.itemNos.includes(item.itemNo)?5000:0)+o.items.filter(i=>t.itemNos.includes(i.itemNo)).length*100+(t.packing===(o.packingType||'NORMAL PACK')?1000:0)+(kind==='overview'?0:t.sheet.cells.filter(c=>text(c.v)==='XS'||text(c.v)==='S').length);}
}
function materialize(book:ExcelJS.Workbook,s:LayoutSheet,data:DocumentTemplates,name=s.name){
 const ws=book.addWorksheet(name.replace(/[\\/?*\[\]:]/g,'_').slice(0,31),{pageSetup:clone(s.pageSetup),views:[{showGridLines:s.showGridLines}]});
 ws.columns=s.columns.map(c=>({...c}));s.rows.forEach((r,i)=>{ws.getRow(i+1).height=r.height;ws.getRow(i+1).hidden=r.hidden;});
 for(const m of s.merges)ws.mergeCells(m[0],m[1],m[2],m[3]);
 for(const c of s.cells){const cell=ws.getCell(c.r,c.c);cell.style=clone(data.styles[c.s]||{});if(cell.isMerged&&cell.master.address!==cell.address)continue;cell.value=c.v?.date?new Date(c.v.date):c.v?.formula?{formula:c.v.formula,result:c.v.result||0}:c.v;}
 if(!ws.pageSetup.printArea)ws.pageSetup.printArea=`A1:${ws.getColumn(s.colCount).letter}${s.rowCount}`;return ws;
}
function mergeItems(o:OrderData,byStyle=false){const groups=new Map<string,OrderItem>();for(const i of o.items){const key=byStyle?i.itemNo:JSON.stringify([pricingCode(i),i.unitPriceUSD,i.factoryProduct?.price,!!i.isPrepack,i.compositionSource==='manual'?poComposition(i):'']);const prior=groups.get(key);if(!prior)groups.set(key,{...i,colors:clone(i.colors)});else {prior.totalQuantity+=i.totalQuantity;prior.colors.push(...clone(i.colors));prior.sizes=[...new Set([...prior.sizes,...i.sizes])];}}return [...groups.values()];}
function gridSizes(item:OrderItem,capacity:number){
 if(item.sizes.length<=capacity)return item.sizes;
 const active=item.sizes.filter(size=>item.colors.some(color=>(color.quantitiesBySize[size]||0)>0));
 const allocated=item.colors.reduce((n,color)=>n+Object.values(color.quantitiesBySize).reduce((sum,qty)=>sum+qty,0),0);
 if(active.length<=capacity&&allocated===item.totalQuantity)return active;
 return item.sizes;
}
function rows(s:LayoutSheet,r:number){return s.cells.filter(c=>c.r===r&&c.v!==null);}
function find(s:LayoutSheet,pattern:RegExp){return s.cells.find(c=>pattern.test(text(c.v).trim()));}
function setLabel(ws:ExcelJS.Worksheet,s:LayoutSheet,pattern:RegExp,value:any){const label=find(s,pattern);if(!label)return;let c=label.c+1;const merged=s.merges.find(m=>m[0]===label.r&&m[1]===label.c);if(merged)c=merged[3]+1;ws.getCell(label.r,c).value=value;}
function setField(ws:ExcelJS.Worksheet,s:LayoutSheet,pattern:RegExp,value:any){
 const label=find(s,pattern);if(!label)return;
 const original=text(label.v),colon=original.search(/[:：]/);
 if(colon>=0&&original.slice(colon+1).trim())ws.getCell(label.r,label.c).value=original.slice(0,colon+1)+' '+String(value??'');
 else setLabel(ws,s,pattern,value);
 return label;
}
function dateValue(v:string){const iso=v.match(/(\d{4})-(\d{2})-(\d{2})/),slash=v.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(iso)return new Date(Date.UTC(+iso[1],+iso[2]-1,+iso[3]));if(slash)return new Date(Date.UTC(+slash[3],+slash[2]-1,+slash[1]));return v;}
function remap(s:LayoutSheet,segments:{start:number;end:number}[]){let next=1;const cells:LayoutCell[]=[],merges:number[][]=[],newRows:LayoutSheet['rows']=[];const starts:number[]=[];for(const part of segments){const start=next;starts.push(start);for(let r=part.start;r<=part.end;r++){newRows.push(clone(s.rows[r-1]||{height:15,hidden:false}));next++;}for(const c of s.cells.filter(c=>c.r>=part.start&&c.r<=part.end))cells.push({...clone(c),r:c.r-part.start+start});for(const m of s.merges.filter(m=>m[0]>=part.start&&m[2]<=part.end))merges.push([m[0]-part.start+start,m[1],m[2]-part.start+start,m[3]]);}
 const pageSetup=clone(s.pageSetup);if(pageSetup.printArea)pageSetup.printArea=pageSetup.printArea.replace(/(\$?[A-Z]+\$?)\d+$/,(_,column)=>`${column}${next-1}`);
 return {sheet:{...clone(s),pageSetup,cells,merges,rows:newRows,rowCount:next-1},starts};}
function mapBlock(ws:ExcelJS.Worksheet,s:LayoutSheet,start:number,dest:number,item:OrderItem,o:OrderData,kind:'pi'|'factory',index:number){
 const set=(r:number,c:number,v:any)=>{ws.getCell(dest+r-start,c).value=v;};
 const quantityCol=kind==='pi'?16:7,priceCol=kind==='pi'?18:8,amountCol=kind==='pi'?19:9;
 set(start,1,kind==='pi'?`${index+1}.`:index+1);set(start,2,item.itemNo);set(start,kind==='pi'?4:3,kind==='pi'?item.styleName.replace(/\s*-\s*Products composition:.*$/i,''):item.chineseName||item.styleName);
 const price=kind==='pi'?item.unitPriceUSD:o.factoryCurrency==='USD'?item.factoryUnitPriceUSD||0:item.unitPriceRMB;
 set(start,quantityCol,item.totalQuantity);set(start,priceCol,price);set(start,amountCol,{formula:`${ws.getColumn(quantityCol).letter}${dest}*${ws.getColumn(priceCol).letter}${dest}`,result:money(item.totalQuantity*price)});
 for(const [col,format] of [[quantityCol,'#,##0'],[priceCol,'#,##0.00'],[amountCol,'#,##0.00']] as const){const cell=ws.getCell(dest,col);cell.numFmt=format;cell.alignment={horizontal:'right',vertical:'middle'};}
 const nextAnchor=s.cells.find(c=>c.r>start&&c.c===2&&/^[A-Z][A-Z0-9-]*\d[A-Z0-9-]*$/.test(text(c.v).trim()));const end=nextAnchor?.r||find(s,/^TOTAL:/)?.r||s.rowCount;
 const descriptionCol=kind==='pi'?4:3,sizeLine=s.cells.find(c=>c.r>start&&c.r<end&&c.c===descriptionCol&&/^(SIZE|尺寸)\s*[:：]/i.test(text(c.v).trim()))?.r||start+2;
 set(start+1,descriptionCol,kind==='pi'?item.description:item.chineseSpec||item.description);
 for(const c of s.cells.filter(c=>c.c===descriptionCol&&c.r>start+1&&c.r<sizeLine))set(c.r,c.c,null);
 set(sizeLine,descriptionCol,`${kind==='pi'?'SIZE:':'尺寸:'} ${orderedSizes(item.sizes).join('/ ')}`);
 if(kind==='factory')return;
 const combination=s.cells.find(c=>c.r>start&&c.r<end&&/COLOR COMBINATION/.test(text(c.v).trim()));
 if(combination){const slots=rows(s,combination.r).filter(c=>c.c>=4).map(c=>c.c);if(item.colors.length>slots.length)throw new Error(`${item.itemNo}：P/I 範本顏色欄位不足，需加入對應 PO 的 P/I 範本。`);for(let n=0;n<slots.length;n++){const color=item.colors[n];set(combination.r,slots[n],color?.colorCode||'');set(combination.r+1,slots[n],color?.colorName||'');set(combination.r+2,slots[n],color?.totalQuantity||0);}}
 const sizeTitle=s.cells.find(c=>c.r>start&&c.r<end&&/COLOR\s*\/\s*SIZE/.test(text(c.v).trim()));if(!sizeTitle)return;
 const sizeRow=sizeTitle.r+1,slots=rows(s,sizeRow).filter(c=>c.c>=3&&c.c<13).map(c=>c.c);const displayedSizes=gridSizes(item,slots.length);if(displayedSizes.length>slots.length)throw new Error(`${item.itemNo}：P/I 範本尺碼欄位不足，需加入對應範本。`);
 const matches=slots.map(c=>displayedSizes.find(size=>size.replace(/\s/g,'').toUpperCase()===text(rows(s,sizeRow).find(x=>x.c===c)?.v).replace(/\s/g,'').toUpperCase()));const keys=matches.some(Boolean)?matches:slots.map((_,n)=>displayedSizes[n]);for(let n=0;n<slots.length;n++)if(keys[n])set(sizeRow,slots[n],keys[n]);
 const colorRows=s.cells.filter(c=>c.c===1&&c.r>sizeRow&&c.r<end&&typeof c.v==='string'&&c.v.trim()).map(c=>c.r);if(item.colors.length>colorRows.length)throw new Error(`${item.itemNo}：P/I 範本顏色列不足，請加入對應範本。`);
 colorRows.forEach((r,n)=>{const color=item.colors[n];set(r,1,color?.colorName||'');slots.forEach((c,i)=>set(r,c,color?.quantitiesBySize[keys[i]!]||0));set(r,13,color?.totalQuantity||0);});
}
function piDocument(data:DocumentTemplates,o:OrderData):ReferenceWorkbook{
 o=normalizeCsqOrder(o);
 const source=pick(data,'pi',o),book=new ExcelJS.Workbook(),priced=mergeItems(o),items=mergeItems({...o,items:priced.filter(i=>!i.erpItemNo)}).concat(mergeItems({...o,items:priced.filter(i=>i.erpItemNo)},true));
 const active=(item:OrderItem)=>{const sizes=item.sizes.filter(size=>item.colors.some(color=>(color.quantitiesBySize[size]||0)>0));return orderedSizes(sizes.length?sizes:item.sizes);};
 const last=Math.max(10,...items.map(item=>active(item).length+4));
 const ws=book.addWorksheet(o.piNumber.slice(0,31),{views:[{showGridLines:false}],pageSetup:{paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0}});
 ws.columns=Array.from({length:last},(_,n)=>({width:n===0?15:n===1?16:n===2?16:n===last-1?18:n===last-2?15:12}));let r=1;
 const edge={style:'thin' as const,color:{argb:'FF000000'}};
 const put=(row:number,start:number,end:number,value:ExcelJS.CellValue,bold=false,grid=false)=>{if(end>start)ws.mergeCells(row,start,row,end);const cell=ws.getCell(row,start);cell.value=value;cell.font={name:'Calibri',size:11,bold};cell.alignment={vertical:'middle',wrapText:true,horizontal:grid?'center':typeof value==='number'||value&&typeof value==='object'&&'formula'in value?'right':'left'};if(grid)cell.border={top:edge,bottom:edge,left:edge,right:edge};return cell;};
 const row=(height=22)=>{ws.getRow(r).height=height;return r++;};
 const full=(value:string,bold=false)=>{const n=row();return put(n,1,last,value,bold);};
 const title=full(COMPANY_ENGLISH,true);title.font.size=26;title.alignment.horizontal='center';ws.getRow(1).height=38;
 const address=o.companyHeader?.address||text(source.sheet.cells.find(c=>/^7F[.,]/.test(text(c.v).trim()))?.v);if(address)full(address).alignment.horizontal='center';
 const contact=o.companyHeader?`TEL: ${o.companyHeader.tel}   FAX: ${o.companyHeader.fax}   ${o.companyHeader.web}`:text(source.sheet.cells.find(c=>/^TEL:/.test(text(c.v).trim()))?.v);if(contact)full(contact).alignment.horizontal='center';
 const heading=full('PROFORMA INVOICE',true);heading.font.size=20;heading.font.underline=true;heading.alignment.horizontal='center';ws.getRow(r-1).height=34;
 const metadataStart=last-2;
 const field=(line:number,label:string,value:string,end=last)=>{put(line,1,1,label);return put(line,2,end,value);};
 // Keep every left-hand value on column B and every document identifier on
 // the same right-hand column, regardless of the number of size columns.
 let n=row();field(n,'MESSRS.:',o.customerName,metadataStart-1);put(n,metadataStart,last,`DATE: ${o.piDate||o.poDate}`);
 n=row();put(n,2,metadataStart-1,o.customerAddress);put(n,metadataStart,last,`P/I NO.: ${o.piNumber}`).border={top:edge,bottom:edge,left:edge,right:edge};
 n=row();field(n,'PAYMENT:',o.paymentTerms,metadataStart-1);put(n,metadataStart,last,`${o.orderingCompany||'CUSTOMER'}'S ORDER NO. ${o.poNumber}`);
 n=row();put(n,2,metadataStart-1,`"${COMPANY_ENGLISH}"`);put(n,metadataStart,last,`CUST#: ${o.customerCode||'CSQ'}`);
 for(const value of [o.bankInfo.bankName,o.bankInfo.address,`ACCOUNT NO. ${o.bankInfo.accountNo}`,`SWIFT ADD: ${o.bankInfo.swiftCode}`])put(row(),2,last,value);
 n=row();field(n,'SHIPMENT:',piShipment(o),last-2);put(n,last-1,last,o.packingType||'NORMAL PACK',true,true);
 field(row(),'TERMS:',piTrade(o));
 for(const [index,remark] of o.remarks.entries())field(row(),index===0?'REMARK:':'',`${index+1}. ${remark.replace(/^\s*\d+[.)]\s*/,'')}`);
 n=row(25);put(n,1,1,'SEP.');put(n,2,3,'ITEM NO.');put(n,4,last-3,'DESCRIPTION');put(n,last-2,last-2,'QUANTITY').alignment.horizontal='right';put(n,last-1,last-1,'UNIT PRICE').alignment.horizontal='right';put(n,last,last,'AMOUNT').alignment.horizontal='right';ws.getRow(n).eachCell(cell=>cell.border={top:edge,bottom:edge});
 n=row();put(n,last-2,last-2,o.items.every(i=>i.erpItemNo?.startsWith('RCL006-'))?'(PRS)':'(PCS)').alignment.horizontal='right';put(n,last-1,last-1,'(USD)').alignment.horizontal='right';put(n,last,last,'(USD)').alignment.horizontal='right';
 for(const [index,item] of items.entries()){
  const variants=item.erpItemNo?priced.filter(i=>i.itemNo===item.itemNo).sort((a,b)=>['S','M','L','XL'].indexOf(a.erpItemNo!.split('-').at(-1)!)-['S','M','L','XL'].indexOf(b.erpItemNo!.split('-').at(-1)!)):[item];
  n=row(25);put(n,1,1,`${index+1}.`);put(n,2,3,item.itemNo);put(n,4,last-3,item.styleName.replace(/\s*-\s*Products composition:.*$/i,''));
  for(const [v,variant] of variants.entries()){
   if(item.erpItemNo){n=row();put(n,4,last-3,`SIZE: ${sizeLabel(variant.erpItemNo!.split('-').at(-1)!)}`);}else if(v)n=row();
   put(n,last-2,last-2,variant.totalQuantity).numFmt='#,##0';put(n,last-1,last-1,variant.unitPriceUSD).numFmt='#,##0.00';put(n,last,last,{formula:`${ws.getColumn(last-2).letter}${n}*${ws.getColumn(last-1).letter}${n}`,result:money(variant.totalQuantity*variant.unitPriceUSD)}).numFmt='#,##0.00';
  }
  const materials=item.compositionSource==='erp'?item.description.split(/\r?\n/).map(line=>line.trim()).filter(Boolean):fabricLines(item.description);
  for(const fabric of materials)put(row(),4,last,fabric);
  const sizes=active(item);put(row(),4,last,`SIZE: ${sizes.join('/ ')}`);
  const end=sizes.length+4,multiple=o.packingType==='MULTIPLE PACK';
  const packs=multiple?multiplePackRows(o.items.filter(i=>i.itemNo===item.itemNo&&i.unitPriceUSD===item.unitPriceUSD)):[];
  if(multiple)put(row(),1,last,'MULTIPLE PACK · QUANTITY / RATIO PER PACK',true);
  n=row(24);put(n,1,1,'COLOR CODE',true,true);put(n,2,3,'COLOR',true,true);sizes.forEach((size,i)=>put(n,i+4,i+4,size,true,true));put(n,end,end,item.erpItemNo?'TTL (PRS)':'TTL (PCS)',true,true);
  const combined=new Map<string,Colorway>();for(const c of item.colors){const p=combined.get(c.colorCode);if(!p)combined.set(c.colorCode,clone(c));else{p.totalQuantity+=c.totalQuantity;for(const [size,q] of Object.entries(c.quantitiesBySize))p.quantitiesBySize[size]=(p.quantitiesBySize[size]||0)+q;}}
  for(const color of combined.values()){
   const details=packs.filter(p=>p.code===color.colorCode),kits=[...new Set(details.map(p=>p.kitCode).filter(Boolean))];
   const colorText=[color.colorName,...kits.map(k=>`KIT: ${k}`)].join('\n');n=row(Math.max(multiple?36:24,colorText.split('\n').reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/32)),0)*15+6));put(n,1,1,color.colorCode,false,true);put(n,2,3,colorText,false,true);
   sizes.forEach((size,i)=>{put(n,i+4,i+4,color.quantitiesBySize[size]||0,false,true).numFmt='#,##0;-#,##0;"--"';});put(n,end,end,color.totalQuantity,false,true).numFmt='#,##0';
   if(multiple){
    for(const pack of details){n=row(32);put(n,1,1,'',false,true);put(n,2,3,`RATIO / PACK\n${pack.packs.toLocaleString('en-US')} PACKS × ${pack.pieces} PCS`,false,true);sizes.forEach((size,i)=>put(n,i+4,i+4,pack.ratio[size]||0,false,true));put(n,end,end,pack.pieces,false,true);for(let c=1;c<=end;c++){const cell=ws.getCell(n,c);cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F4F3'}};cell.font={name:'Calibri',size:10,color:{argb:'FF4B6864'}};}}
    if(!details.length){n=row();put(n,1,end,'PACK RATIO: TO BE CONFIRMED',false,true);}
   }
  }
  row(10);
 }
 const quantity=items.reduce((sum,item)=>sum+item.totalQuantity,0),amount=money(priced.reduce((sum,item)=>sum+item.totalQuantity*item.unitPriceUSD,0));n=row(26);put(n,1,last-3,'TOTAL:',true);put(n,last-2,last-2,quantity,true).numFmt='#,##0';put(n,last-1,last-1,'USD').alignment.horizontal='right';put(n,last,last,amount,true).numFmt='#,##0.00';ws.getRow(n).eachCell(cell=>cell.border={top:edge,bottom:{style:'double',color:edge.color}});
 full(amountToEnglishWords(amount).toUpperCase());row(24);
 n=row();put(n,1,metadataStart-1,o.customerName,true);put(n,metadataStart,last,COMPANY_ENGLISH,true).alignment.horizontal='center';
 n=row(28);put(n,1,2,'').border={bottom:edge};put(n,metadataStart,last-1,'').border={bottom:edge};
 n=row();put(n,1,metadataStart-1,'(PLEASE KINDLY SIGN BACK, THANKS!!)');put(n,metadataStart,last,`(Manager Director: ${o.companyHeader?.managerDirector||'Giant Kao'})`).alignment.horizontal='center';
 ws.pageSetup.printArea=`A1:${ws.getColumn(last).letter}${r-1}`;return {book,sources:[source.file]};
}
function businessDocument(data:DocumentTemplates,kind:'pi'|'factory',order:OrderData,refs:CsqReference[],workspace?:Workspace):ReferenceWorkbook{
 const o=kind==='factory'?withFactoryReferenceTerms(data,factoryDocument(order,refs,workspace)):order;if(kind==='factory'&&(!o.factorySupplier||o.items.some(i=>(o.factoryCurrency==='USD'?i.factoryUnitPriceUSD||0:i.unitPriceRMB)<=0)))throw new Error('請先確認並帶入 ERP 工廠與採購單價，再預覽或匯出採購單。');const t=pick(data,kind,o);const items=mergeItems(o);if(items.every(i=>i.erpItemNo))items.sort((a,b)=>['S','M','L','XL'].indexOf(a.erpItemNo!.split('-').at(-1)!)-['S','M','L','XL'].indexOf(b.erpItemNo!.split('-').at(-1)!));data={...data,styles:[...data.styles]};const s=t.sheet;
 const anchors=s.cells.filter(c=>c.c===2&&c.r>15&&/^[A-Z][A-Z0-9-]*\d[A-Z0-9-]*$/.test(text(c.v).trim())).sort((a,b)=>a.r-b.r);
 const total=find(s,kind==='pi'?/^TOTAL:/:/^合\s*計\s*[:：]/);if(!anchors.length||!total)throw new Error('這份文件範本的品項區需另行設定，請選擇可用的範本。');
 const selected=items.map(i=>anchors.find(a=>text(a.v).trim()===i.itemNo.trim())||anchors[0]);
 const fees=kind==='factory'?(o.factoryExtraFees||[]).filter(f=>f.amount!==0||f.description.trim()):[];
 if(fees.some(f=>!f.description.trim()||!Number.isFinite(f.amount)||f.amount<0))throw new Error('請填寫額外費用名稱與有效金額（不可小於 0）。');
 if(kind==='factory'&&o.hasDeposit&&(!(o.depositPercent!>0)||o.depositPercent!>100))throw new Error('請填寫 0 至 100% 之間的訂金比例。');
 const segments=[{start:1,end:anchors[0].r-1},...selected.map(a=>({start:a.r,end:anchors.find(next=>next.r>a.r)?.r?anchors.find(next=>next.r>a.r)!.r-1:total.r-1})),...(fees.length?Array.from({length:fees.length+1},()=>({start:total.r,end:total.r})):[]),{start:total.r,end:s.rowCount}];
 const transformed=remap(s,segments);const book=new ExcelJS.Workbook();const ws=materialize(book,transformed.sheet,data,o.piNumber);
 if(kind==='factory'){
  // Some supplier templates keep extra quantities or deposit calculations
  // beside the official columns. Clear sample figures before filling this PO.
  const start=transformed.starts[1],end=transformed.starts.at(-1)!;
  for(let r=start;r<=end;r++)for(let c=6;c<=s.colCount;c++){
   const cell=ws.getCell(r,c),value=cell.value;
   if((!cell.isMerged||cell.master.address===cell.address)&&(typeof value==='number'||value&&typeof value==='object'&&'formula'in value))cell.value=null;
  }
 }
 if(kind==='factory')items.forEach((i,n)=>{
  if(!i.erpItemNo){mapBlock(ws,s,selected[n].r,transformed.starts[n+1],i,o,kind,n);return;}
  const start=transformed.starts[n+1],end=transformed.starts[n+2]-1;
  for(const range of [...ws.model.merges]){const [a,b]=range.split(':');if(Number(ws.getCell(a).row)>=start&&Number(ws.getCell(b).row)<=end)ws.unMergeCells(range);}
  for(let r=start;r<=end;r++){for(let c=1;c<=s.colCount;c++)ws.getCell(r,c).value=null;ws.getRow(r).hidden=r>start;}
  ws.mergeCells(start,3,start,6);ws.getCell(start,1).value=n+1;ws.getCell(start,2).value=pricingCode(i);
  const size=i.erpItemNo.split('-').at(-1)!,sourceSize=s.cells.find(c=>c.c===3&&new RegExp(`^尺寸[:：]\\s*${size}\\(`).test(text(c.v))),dimensions=sourceSize?text(s.cells.find(c=>c.r===sourceSize.r+1&&c.c===3)?.v):'';
  ws.getCell(start,3).value=[i.chineseName,i.chineseSpec,`SIZE: ${sizeLabel(size)}`,dimensions].filter(Boolean).join('\n');ws.getRow(start).height=Math.min(409,Math.max(90,ws.getCell(start,3).text.split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/40)),0)*16+12));
  const price=o.factoryCurrency==='USD'?i.factoryUnitPriceUSD||0:i.unitPriceRMB;
  ws.getCell(start,7).value=i.totalQuantity;ws.getCell(start,8).value=price;ws.getCell(start,9).value={formula:`G${start}*H${start}`,result:money(i.totalQuantity*price)};
 });
 if(kind==='factory')for(const sampleFee of transformed.sheet.cells.filter(c=>c.r>=transformed.starts[1]&&c.r<transformed.starts.at(-1)!&&/小\s*[缸缶]/.test(text(c.v).trim()))){
  ws.getCell(sampleFee.r,sampleFee.c).value=null;
  let populated=false;ws.getRow(sampleFee.r).eachCell(cell=>{if((!cell.isMerged||cell.master.address===cell.address)&&cell.value!==null&&cell.text.trim())populated=true;});
  if(!populated)ws.getRow(sampleFee.r).hidden=true;
 }
 const footer=transformed.starts.at(-1)!;const subtotal=money(items.reduce((n,i)=>n+i.totalQuantity*(kind==='pi'?i.unitPriceUSD:o.factoryCurrency==='USD'?i.factoryUnitPriceUSD||0:i.unitPriceRMB),0)),amount=money(subtotal+fees.reduce((sum,f)=>sum+f.amount,0)),quantity=items.reduce((n,i)=>n+i.totalQuantity,0);
 ws.getCell(footer,kind==='pi'?15:7).value=quantity;ws.getCell(footer,kind==='pi'?19:9).value=amount;
 const sourceText=(pattern:RegExp,value:string)=>{for(const c of transformed.sheet.cells.filter(c=>pattern.test(text(c.v).trim()))){const cell=ws.getCell(c.r,c.c);if(!cell.isMerged||cell.master.address===cell.address)cell.value=value;}};
 if(kind==='pi'){
  ws.getCell('B7').value=o.customerName;sourceText(/^DATE:/,`DATE: ${o.piDate||o.poDate}`);sourceText(/^P\/I NO\./,`P/I NO.: ${o.piNumber}`);sourceText(/ORDER NO\./,`${o.orderingCompany||'CUSTOMER'}'S ORDER NO.${o.poNumber}`);sourceText(/^PAYMENT:/,`PAYMENT: ${o.paymentTerms}`);sourceText(/^SHIPMENT:/,`SHIPMENT: ${piShipment(o)}`);sourceText(/^TERMS:/,`TERMS: ${piTrade(o)}`);sourceText(/^(NORMAL|MULTIPLE) PACK$/,o.packingType||'NORMAL PACK');
  sourceText(/^ACCOUNT NO\./,`ACCOUNT NO. ${o.bankInfo.accountNo}`);sourceText(/^SWIFT ADD:/,`SWIFT ADD: ${o.bankInfo.swiftCode}`);sourceText(/^MEGA INTERNATIONAL/,o.bankInfo.bankName);ws.getCell(footer+1,1).value=amountToEnglishWords(amount).toUpperCase();
  for(const c of transformed.sheet.cells.filter(c=>c.r>footer&&c.c===1&&text(c.v)===text(rows(s,7).find(x=>x.c===2)?.v)))ws.getCell(c.r,c.c).value=o.customerName;
 }else{
  const supplierName=chineseFactoryName(o.factorySupplier),currency=o.factoryCurrency||'RMB';
  // The generated table uses A:I. The source's extra calculation column
  // must not reserve an empty strip along the right side of the document.
  for(let col=10;col<=s.colCount;col++)ws.getColumn(col).hidden=true;
  const visibleLast=9;
  [15,19,17,8,8,8,12,13,18].forEach((width,index)=>ws.getColumn(index+1).width=width);
  ws.eachRow(row=>row.eachCell(cell=>{if(cell.isMerged&&cell.master.address!==cell.address)return;cell.font={...cell.font,size:row.number>footer+1?10:11};cell.alignment={...cell.alignment,vertical:'middle',wrapText:true};}));
  for(const c of transformed.sheet.cells.filter(c=>c.c===1&&/^(供\s*[應应]\s*商|付\s*款\s*方\s*式|交\s*貨\s*地\s*點|交\s*貨\s*日\s*期|交\s*易\s*條\s*件|金\s*額\s*總\s*[計计])\s*[:：]/.test(text(c.v).trim())))ws.getCell(c.r,1).value=text(c.v).replace(/\s+/g,'');
  for(const c of transformed.sheet.cells.filter(c=>c.r>footer&&c.c===1&&/^\s*直接由[貨货]款中扣除/.test(text(c.v).trim()))){
   const previous=ws.getCell(c.r-1,1),continuation=ws.getCell(c.r,1);
   previous.value=previous.text.trimEnd()+text(c.v).trim();continuation.value=null;
   if(!transformed.sheet.cells.some(other=>other.r===c.r&&other.c!==1&&text(other.v).trim()))ws.getRow(c.r).hidden=true;
  }
  ws.pageSetup={...ws.pageSetup,paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0,scale:undefined,horizontalCentered:true,printArea:`A1:I${transformed.sheet.rowCount}`,margins:{left:.3,right:.3,top:.35,bottom:.35,header:.15,footer:.15}};
  const itemHeader=find(s,/^序\s*[號号]$/);
  if(itemHeader){
   for(let row=itemHeader.r;row<=itemHeader.r+1;row++)for(let col=6;col<=s.colCount;col++)ws.getCell(row,col).value=null;
   for(const [col,label] of [[7,'數量'],[8,'單價'],[9,'金額']] as const){const cell=ws.getCell(itemHeader.r,col);cell.value=label;cell.alignment={horizontal:'right',vertical:'middle'};}
   ws.getCell(itemHeader.r+1,7).value=`(${o.factoryQuantityUnit||'件'})`;ws.getCell(itemHeader.r+1,8).value=`(${currency})`;ws.getCell(itemHeader.r+1,9).value=`(${currency})`;
   for(let col=7;col<=9;col++)ws.getCell(itemHeader.r+1,col).alignment={horizontal:'right',vertical:'middle'};
  }
  for(const pattern of [/SPORTS KITE|G\.K\. SPORTS/i,/^\s*TEL\s*:/i,/^採\s*購\s*單$/]){
   const heading=transformed.sheet.cells.find(c=>c.r<=4&&pattern.test(text(c.v).trim()));if(!heading)continue;
   const cell=ws.getCell(heading.r,heading.c),value=cell.text.trim(),style=clone(cell.style);
   for(const range of [...ws.model.merges]){const [start,end]=range.split(':');if(Number(ws.getCell(start).row)===heading.r&&Number(ws.getCell(end).row)===heading.r)ws.unMergeCells(range);}
   for(let col=1;col<=s.colCount;col++)ws.getCell(heading.r,col).value=null;
   ws.mergeCells(heading.r,1,heading.r,visibleLast);const centered=ws.getCell(heading.r,1);centered.value=value;centered.style=style;centered.font={...style.font,size:heading.r===1?22:pattern.source.includes('TEL')?10:20};centered.alignment={...style.alignment,horizontal:'center',vertical:'middle',wrapText:true};
  }
  const supplier=setField(ws,s,/供\s*[應应]\s*商\s*[:：]/,supplierName);
  setField(ws,s,/採\s*購\s*日\s*期\s*[:：]/,o.piDate||o.poDate);
  setField(ws,s,/採\s*購\s*單\s*[號号]\s*[:：]/,o.piNumber);
  setField(ws,s,/客\s*人\s*訂\s*單\s*[:：]/,o.poNumber);
  setField(ws,s,/供\s*[應应]\s*商\s*[號号]\s*[:：]/,o.supplierCode);
  const deposit=money(amount*(o.depositPercent||0)/100);
  const payment=setField(ws,s,/付\s*款\s*方\s*式\s*[:：]/,o.factoryTermsSettings?.reference||o.factoryTermsSettings?.payment!==undefined?o.factoryTerms:o.hasDeposit?`1. 下單後支付${o.depositPercent}%訂金(${currency} ${deposit.toFixed(2)}).\n2. 出貨後備齊PACKING LIST, INVOICE, C/O予我司,我司收到COPY文件後即安排支付餘款.`:o.factoryTerms);
  if(payment){ws.getRow(payment.r).height=Math.max(ws.getRow(payment.r).height||15,Math.min(180,Math.max(1,o.factoryTerms.split('\n').reduce((n,line)=>n+Math.ceil(line.length/65),0))*15+8));const continuation=rows(s,payment.r+1);if(!continuation.some(c=>c.c===1&&text(c.v).trim()))for(const c of continuation.filter(c=>c.c===2&&typeof c.v==='string'))ws.getCell(c.r,c.c).value='';}
  setField(ws,s,/交\s*貨\s*地\s*點\s*[:：]/,o.deliveryPlace);
  setField(ws,s,/交\s*貨\s*日\s*期\s*[:：]/,factoryDeadline(o.factoryShipDate));
  setField(ws,s,/交\s*易\s*條\s*件\s*[:：]/,factoryTrade(o));
  for(const pack of transformed.sheet.cells.filter(c=>/^(NORMAL|MULTIPLE) PACK$|^[單单][碼码]包[裝装]$|^混[碼码]包[裝装]$/.test(text(c.v).replace(/\s+/g,' ').trim())))ws.getCell(pack.r,pack.c).value=null;
  const packRow=find(s,/交\s*貨\s*日\s*期\s*[:：]/)?.r||find(s,/交\s*易\s*條\s*件\s*[:：]/)?.r||anchors[0].r-2,packColumn=s.colCount-2;
  for(const range of [...ws.model.merges]){const [start,end]=range.split(':');const first=ws.getCell(start),last=ws.getCell(end);if(Number(first.row)<=packRow&&Number(last.row)>=packRow&&Number(last.col)>=packColumn)ws.unMergeCells(range);}
  ws.mergeCells(packRow,packColumn,packRow,visibleLast);const packing=ws.getCell(packRow,packColumn);packing.value=packingChinese(o);packing.font={name:'Microsoft JhengHei',size:11,bold:true};packing.alignment={horizontal:'center',vertical:'middle',wrapText:true};const packEdge={style:'thin' as const,color:{argb:'FF000000'}};packing.border={top:packEdge,bottom:packEdge,left:packEdge,right:packEdge};ws.getRow(packRow).height=Math.max(ws.getRow(packRow).height||15,24);
  if(fees.length){const start=transformed.starts[items.length+1];ws.getCell(start,1).value='貨款小計：';ws.getCell(start,7).value=quantity;ws.getCell(start,8).value=currency;ws.getCell(start,9).value=subtotal;fees.forEach((fee,index)=>{const r=start+index+1;ws.getCell(r,1).value=`額外費用：${fee.description}`;ws.getCell(r,7).value=null;ws.getCell(r,8).value=currency;ws.getCell(r,9).value=money(fee.amount);});ws.getCell(footer,1).value='採購總額：';}
  for(let row=transformed.starts[1];row<=footer;row++)for(let col=7;col<=9;col++){
   const cell=ws.getCell(row,col),value=cell.value;
   if(typeof value==='number'||value&&typeof value==='object'&&'formula'in value){cell.numFmt=col===7?'#,##0':'#,##0.00';cell.alignment={...cell.alignment,horizontal:'right',vertical:'middle'};}
  }
  sourceText(/^\((USD|RMB|人民币|人民幣|美金)\/(件|雙|双)\)$/,`(${o.factoryCurrency||'RMB'}/${o.factoryQuantityUnit||'件'})`);sourceText(/^\((人民币|人民幣|美金|USD|RMB)\)$/,`(${o.factoryCurrency||'RMB'})`);sourceText(/^\((件|雙|双)\)$/,`(${o.factoryQuantityUnit||'件'})`);ws.getCell(footer,8).value=o.factoryCurrency||'RMB';ws.getCell(footer+1,2).value=amountToChineseWords(amount).replace(/^人民幣/,o.factoryCurrency==='USD'?'美金':'人民幣');
  for(let row=transformed.starts[1];row<=footer;row++){const cell=ws.getCell(row,8);if(cell.text===currency)cell.alignment={...cell.alignment,horizontal:'right',vertical:'middle'};}
  const oldSupplier=supplier?text(rows(s,supplier.r).find(c=>c.c===supplier.c+1)?.v).trim():'';if(oldSupplier)sourceText(new RegExp(`^${oldSupplier.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`),supplierName);
 }
 return {book,sources:[t.file]};
}
function quantityDocument(data:DocumentTemplates,o:OrderData,refs:CsqReference[],workspace?:Workspace):ReferenceWorkbook{
 const book=new ExcelJS.Workbook(),sources:string[]=[];if(o.items.every(i=>i.erpItemNo?.startsWith('RCL006-')))o={...o,factoryQuantityUnit:'雙'};
 for(const item of mergeItems(o,true)){
  const t=pick(data,'quantity',o,item),s=t.sheet,ref=findCsqReference(item.itemNo,o.poNumber,refs),ws=book.addWorksheet(item.itemNo.slice(0,31),{pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0},views:[{showGridLines:false}]});sources.push(t.file+' / '+s.name);
  const colors=new Map<string,Colorway>();for(const color of item.colors){const prior=colors.get(color.colorCode);if(!prior)colors.set(color.colorCode,clone(color));else{prior.totalQuantity+=color.totalQuantity;for(const [size,qty] of Object.entries(color.quantitiesBySize))prior.quantitiesBySize[size]=(prior.quantitiesBySize[size]||0)+qty;}}
  const sizes=item.sizes.filter(size=>[...colors.values()].some(color=>(color.quantitiesBySize[size]||0)>0));const keys=orderedSizes(sizes.length?sizes:item.sizes),multiple=o.packingType==='MULTIPLE PACK',packs=multiple?multiplePackRows(o.items.filter(i=>i.itemNo===item.itemNo)):[];const totalCol=keys.length+3,last=totalCol;
  ws.columns=[{width:16},{width:32},...keys.map(()=>({width:11})),{width:14}];let r=1;
  const full=(value:string,bold=false)=>{ws.mergeCells(r,1,r,last);const cell=ws.getCell(r,1);cell.value=value;cell.font={size:r===1?20:11,bold};cell.alignment={vertical:'middle',wrapText:true};ws.getRow(r).height=r===1?32:24;return r++;};
  full(COMPANY_ENGLISH,true);ws.getCell(1,1).alignment.horizontal='center';full('數量明細表',true);ws.getCell(2,1).alignment.horizontal='center';
  const edge={style:'thin' as const};
  const infoCell=(start:number,end:number,value:string,bold=false,label=false)=>{if(end>start)ws.mergeCells(r,start,r,end);const cell=ws.getCell(r,start);cell.value=value;cell.font={size:11,bold};cell.alignment={vertical:'middle',horizontal:label?'center':'left',wrapText:true};cell.border={top:edge,bottom:edge,left:edge,right:edge};if(label)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F3F2'}};return cell;};
  const split=Math.max(2,Math.floor(last/2)); if(last>=4)ws.getColumn(split+1).width=18;
  const infoPair=(leftLabel:string,leftValue:string,rightLabel:string,rightValue:string)=>{ws.getRow(r).height=29;if(last>=4){infoCell(1,1,leftLabel,false,true);infoCell(2,split,leftValue);infoCell(split+1,split+1,rightLabel,false,true);infoCell(split+2,last,rightValue);}else{infoCell(1,1,leftLabel,false,true);infoCell(2,last,`${leftValue}　${rightLabel}${rightValue}`);}return r++;};
  const infoFull=(label:string,value:string)=>{ws.getRow(r).height=29;infoCell(1,1,label,false,true);infoCell(2,last,value);return r++;};
  infoPair('工廠：',item.factoryProduct?.supplier||o.factorySupplier?chineseFactoryName(item.factoryProduct?.supplier||o.factorySupplier):'待確認','工廠交期：',o.factoryShipDate||'待確認');
  infoPair('訂單號碼：',o.piNumber,'客戶 PO：',o.poNumber);infoPair('品號：',item.itemNo,'下單日期：',o.poDate||'待確認');
  const bilingual=factoryText(item,workspace?.productNotes[item.itemNo],ref);
  infoFull('品名：',bilingual.name);
  for(const [index,pair] of bilingual.materials.pairs.entries())infoFull(`面料${bilingual.materials.pairs.length>1?` ${index+1}`:''}：`,[pair.english,pair.chinese].filter(Boolean).join('\n'));
  if(bilingual.materials.unpaired)infoFull('中文規格（待配對）：',bilingual.materials.unpaired);
  const pack=infoPair('數量：',`${item.totalQuantity.toLocaleString('en-US')} ${o.factoryQuantityUnit||'件'}`,'包裝方式：',packingChinese(o,true));const packCell=ws.getCell(pack,last>=4?split+2:2);packCell.font={...packCell.font,bold:true};packCell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFFF99'}};
  const antiCounterfeitRow=infoFull('防偽標：',o.requiresAntiCounterfeitLabel===true?'需要防偽標':o.requiresAntiCounterfeitLabel===false?'不需要防偽標':'待確認（請在訂單核對頁選擇）');
  const antiCounterfeitCell=ws.getCell(antiCounterfeitRow,2);antiCounterfeitCell.font={size:12,bold:true};if(o.requiresAntiCounterfeitLabel===true)antiCounterfeitCell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFFF99'}};
  const tableRow=(values:ExcelJS.CellValue[],bold=false)=>{const row=ws.getRow(r++);row.values=values;row.height=25;row.eachCell(cell=>{cell.font={size:11,bold};cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};cell.border={top:edge,bottom:edge,left:edge,right:edge};cell.numFmt='#,##0;-#,##0;"--"';});return row;};
  const header=tableRow(['色碼','色名',...keys.map(size=>item.erpItemNo?sizeLabel(size):size),`合計（${o.factoryQuantityUnit||'件'}）`],true);header.eachCell(cell=>cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F3F2'}});
  if(item.erpItemNo){
   for(const label of ['尺寸','重量']){const source=s.cells.find(c=>text(c.v).trim()===label);if(!source)continue;const sourceSizes=s.cells.filter(c=>c.r===source.r-(label==='重量'?2:1)&&typeof c.v==='string'&&/\([SMLX]+\)/.test(c.v));tableRow([label,'',...keys.map(size=>{const col=sourceSizes.find(c=>text(c.v).includes(`(${size})`))?.c;return col?text(s.cells.find(c=>c.r===source.r&&c.c===col)?.v):'';}),'']);}
  }
  const colorStart=r,quantityRows:number[]=[];for(const color of colors.values()){
   const details=packs.filter(p=>p.code===color.colorCode),kits=[...new Set(details.map(p=>p.kitCode).filter(Boolean))];
   const name=[color.colorName,colorChinese(color,item.itemNo,o.poNumber,data,workspace?.productNotes[item.itemNo]),...kits.map(k=>`KIT: ${k}`)].filter(Boolean).join('\n');
   quantityRows.push(r);const row=tableRow([color.colorCode,name,...keys.map(size=>color.quantitiesBySize[size]||0),color.totalQuantity]);row.height=Math.max(25,name.split('\n').reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/32)),0)*15+6);
   if(multiple){
    for(const pack of details){const ratioRow=tableRow(['',`每包配比\n${pack.packs.toLocaleString('en-US')} 包 × ${pack.pieces} 件`,...keys.map(size=>pack.ratio[size]||0),pack.pieces]);ratioRow.height=34;ratioRow.eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F4F3'}};cell.font={size:10,color:{argb:'FF4B6864'}};});}
    if(!details.length)tableRow(['','每包配比待確認',...keys.map(()=>''),'']);
   }
  }
  const sum=(col:number)=>multiple?`SUM(${quantityRows.map(row=>`${ws.getColumn(col).letter}${row}`).join(',')})`:`SUM(${ws.getColumn(col).letter}${colorStart}:${ws.getColumn(col).letter}${r-1})`;
  const totalRow=tableRow(['合計','',...keys.map((size,n)=>({formula:sum(n+3),result:[...colors.values()].reduce((sum,color)=>sum+(color.quantitiesBySize[size]||0),0)})),{formula:sum(totalCol),result:item.totalQuantity}],true);ws.mergeCells(totalRow.number,1,totalRow.number,2);
  // A borrowed style template is not evidence for this PO's labels, tags or
  // mixed-size packing requirements. Use the actual order's packing mode.
  const sourcePacking=item.erpItemNo&&t.poNumbers.includes(o.poNumber)?s.cells.find(c=>/^包[裝装]方式[:：]/.test(text(c.v).trim())):undefined;
  if(sourcePacking&&o.packingType!=='MULTIPLE PACK'){
   for(const c of s.cells.filter(c=>c.c===sourcePacking.c&&c.r>=sourcePacking.r&&c.r<=sourcePacking.r+3&&typeof c.v==='string'))full(o.requiresAntiCounterfeitLabel===true?text(c.v):text(c.v).replace(/[\/／]?防[偽伪][標标][\/／]?/g,'/'));
  }else if(o.packingType==='MULTIPLE PACK'){
   full('單色混碼裝：依表內各色配比裝袋，包數 × 每包件數須與各色數量相符。');
   full('條碼、吊牌、標籤及外箱要求依本款客戶確認資料執行。');
   full('所有主副料均需符合歐洲 REACH 環保標準。');
  }else{
   const cartonQuantity=o.normalCartonQuantity??50;if(!Number.isInteger(cartonQuantity)||cartonQuantity<1)throw new Error('單色單碼每箱件數須為大於 0 的整數。');
   full([`1${o.factoryQuantityUnit||'件'}`,'商標',...(o.requiresAntiCounterfeitLabel===true?['防偽標']:[]),'防盜標','主吊牌','條碼吊牌','PE袋','電腦條碼','納米乾燥劑'].join('/'));
   full(`${cartonQuantity}${o.factoryQuantityUnit||'件'}/單色單碼入箱/天地蓋/七層外箱.(箱規固定)`);
   full('具體配色看作工圖要求');
  }
  ws.pageSetup.printArea=`A1:${ws.getColumn(last).letter}${r-1}`;
 }
 return {book,sources};
}
function overviewDocument(data:DocumentTemplates,o:OrderData):ReferenceWorkbook{
 const t=pick(data,'overview',o),items=mergeItems(o);let s=t.sheet;
 if(items.every(i=>i.erpItemNo?.startsWith('RCL006-')))items.sort((a,b)=>['S','M','L','XL'].indexOf(a.erpItemNo!.split('-').at(-1)!)-['S','M','L','XL'].indexOf(b.erpItemNo!.split('-').at(-1)!));
 const totalCell=(sheet:LayoutSheet)=>{const total=find(sheet,/^GRAND TOTAL:/);if(!total)throw new Error('早見表範本缺少總計列');return total;};
 const itemCells=(sheet:LayoutSheet)=>sheet.cells.filter(c=>c.c===2&&c.r>7&&c.r<totalCell(sheet).r&&/^[A-Z][A-Z0-9-]*\d[A-Z0-9-]*$/.test(text(c.v).trim())).sort((a,b)=>a.r-b.r);
 const slots=itemCells(s);if(!slots.length)throw new Error('早見表範本缺少品項列');
 if(items.length>slots.length){
  const first=slots[0].r,footer=totalCell(s).r;
  s=remap(s,[{start:1,end:first-1},...items.map(()=>({start:first,end:first})),{start:footer,end:s.rowCount}]).sheet;
 }
 const shippingMark=find(s,/^SHIPPING\s+MARK\s*:/i),remark=s.cells.find(c=>c.r>totalCell(s).r&&/^REMARK\s*:/i.test(text(c.v).trim()));
 if(shippingMark&&remark&&remark.r>shippingMark.r)s=remap(s,[{start:1,end:shippingMark.r-1},{start:remark.r,end:s.rowCount}]).sheet;
 const book=new ExcelJS.Workbook(),ws=materialize(book,s,data,o.piNumber),total=totalCell(s),sourceItems=itemCells(s);
 ws.getCell('D1').value=o.customerName;ws.getCell('J1').value=o.piNumber;ws.getCell('J2').value=o.piNumber;ws.getCell('D2').value=dateValue(o.poDate);ws.getCell('J3').value=o.poNumber;ws.getCell('D5').value=o.paymentTerms;ws.getCell('J5').value=/^FOB\b/i.test(o.tradeTerms.trim())?piTrade(o).replace(/\s+BY\s+(?:SEA|AIR)$/i,''):o.tradeTerms;ws.getCell('D6').value=dateValue(o.shipmentDate);ws.getCell('J6').value=o.packingType||'NORMAL PACK';
 const bankValue=ws.getCell('D4').value;
 for(const range of [...ws.model.merges]){
  const [start,end]=range.split(':');const first=ws.getCell(start),last=ws.getCell(end);
  if(Number(first.row)===4&&Number(last.row)===4&&Number(last.col)>=9)ws.unMergeCells(range);
 }
 const headerEdge={style:'thin' as const,color:{argb:'FF000000'}};
 for(let col=4;col<=s.colCount;col++)ws.getCell(4,col).border={top:headerEdge,bottom:headerEdge};
 ws.mergeCells(4,4,4,7);ws.getCell('D4').value=bankValue;
 ws.mergeCells(4,8,4,s.colCount);
 const classification=normalizeClassification(o),seriesSeason=ws.getCell('H4');
 seriesSeason.border={top:headerEdge,bottom:headerEdge,left:headerEdge,right:headerEdge};
 seriesSeason.value=[classification.series?.trim(),classification.season?.trim()].filter(Boolean).join(' ');
 seriesSeason.font={name:'Calibri',size:12,bold:true};seriesSeason.alignment={horizontal:'left',vertical:'middle',wrapText:true};
 for(let row=1;row<=6;row++)for(let col=1;col<=s.colCount;col++){const cell=ws.getCell(row,col);cell.alignment={...cell.alignment,vertical:'middle',horizontal:'left'};}
 for(const range of [...ws.model.merges]){const [a,b]=range.split(':');if(Number(ws.getCell(a).row)===7&&Number(ws.getCell(b).row)===7)ws.unMergeCells(range);}
 for(let col=1;col<=s.colCount;col++)ws.getCell(7,col).value=null;
 for(const [start,end,label] of [[1,3,'ORDER CONTENTS:'],[4,5,'QUANTITY'],[6,8,'UNIT PRICE'],[9,10,'S/C AMT'],[11,s.colCount,'工廠／交期']] as const){
  ws.mergeCells(7,start,7,end);const cell=ws.getCell(7,start);cell.value=label;cell.font={name:'Calibri',size:11,bold:true};cell.alignment={horizontal:start===1?'left':'center',vertical:'middle',wrapText:true};cell.border={top:headerEdge,bottom:headerEdge};
 }
 ws.getRow(7).height=24;
 const sectionRows=s.cells.filter(c=>c.c===1&&c.r>=8&&c.r<total.r&&/^CS\d/.test(text(c.v).trim()));
 const matchingSection=sectionRows.find(c=>text(c.v).includes(o.piNumber));const nextSection=sectionRows.find(c=>matchingSection&&c.r>matchingSection.r);
 const preferred=matchingSection?sourceItems.filter(c=>c.r>matchingSection.r&&c.r<(nextSection?.r||total.r)):sourceItems;
 // Fill physical rows in PO order, instead of returning each style to its
 // original template row (which would scramble the displayed sequence).
 const destinations=[...(preferred.length>=items.length?preferred:sourceItems)].sort((a,b)=>a.r-b.r),usedRows=new Set<number>();
 // Remove vertical factory merges before hiding unused template rows.
 for(const range of [...ws.model.merges]){const [start,end]=range.split(':');const first=ws.getCell(start),last=ws.getCell(end);if(Number(first.row)>=8&&Number(last.row)<total.r&&(first.row!==last.row||Number(last.col)>=11))ws.unMergeCells(range);}
 for(let r=8;r<total.r;r++)for(let c=1;c<=s.colCount;c++)if(!ws.getCell(r,c).isMerged||ws.getCell(r,c).master.address===ws.getCell(r,c).address)ws.getCell(r,c).value=null;
 // Reference sheets contain separators for orders that are cleared above.
 // Keep this item's area open; the header, grand total and outer frame remain.
 for(let r=8;r<total.r;r++)for(let c=1;c<=s.colCount;c++)ws.getCell(r,c).border={};
 if(matchingSection)ws.getCell(matchingSection.r,1).value=o.piNumber;
 items.forEach((i,n)=>{const original=destinations[n];const r=original.r;usedRows.add(r);const values=rows(s,r);
  const quantity=values.find(c=>typeof c.v==='number'&&c.c>=4&&c.c<=5)?.c||4;const price=values.find(c=>typeof c.v==='number'&&c.c>=7&&c.c<=8)?.c||7;
  const unit=text(values.find(c=>c.c===quantity+1)?.v)||'PCS';
  ws.getCell(r,1).value=n+1;ws.getCell(r,2).value=pricingCode(i);ws.getCell(r,quantity).value=i.totalQuantity;ws.getCell(r,quantity+1).value=unit;ws.getCell(r,price-1).value='@';ws.getCell(r,price).value=i.unitPriceUSD;ws.getCell(r,9).value='USD';ws.getCell(r,10).value={formula:`${ws.getColumn(quantity).letter}${r}*${ws.getColumn(price).letter}${r}`,result:money(i.totalQuantity*i.unitPriceUSD)};ws.getCell(r,11).value=`${i.factoryProduct?.supplierCode||'待確認'}\n${o.factoryShipDate}`;
  for(let col=1;col<=s.colCount;col++){const cell=ws.getCell(r,col);cell.alignment={...cell.alignment,vertical:'middle'};}
  ws.mergeCells(r,11,r,s.colCount);ws.getCell(r,11).alignment={horizontal:'center',vertical:'middle',wrapText:true};ws.getCell(r,11).font={name:'Calibri',size:11};
  ws.getCell(r,1).alignment={horizontal:'center',vertical:'middle'};ws.getCell(r,price-1).alignment={horizontal:'center',vertical:'middle'};ws.getCell(r,price).alignment={horizontal:'right',vertical:'middle'};ws.getCell(r,9).alignment={horizontal:'center',vertical:'middle'};ws.getCell(r,10).alignment={horizontal:'right',vertical:'middle'};
  const qty=ws.getCell(r,quantity);qty.alignment={...qty.alignment,horizontal:'right'};qty.numFmt='#,##0';ws.getCell(r,quantity+1).alignment={horizontal:'left',vertical:'middle'};
 });
 for(let r=8;r<total.r;r++){const row=ws.getRow(r);row.hidden=!usedRows.has(r)&&r!==matchingSection?.r;row.height=usedRows.has(r)?24:20;}
 // Display each factory/deadline once in physical row order.
 let previousDelivery:string|undefined;
 for(const r of [...usedRows].sort((a,b)=>a-b)){
  const cell=ws.getCell(r,11),delivery=cell.text;
  if(delivery===previousDelivery)cell.value=null;
  else if(previousDelivery!==undefined)for(let c=1;c<=s.colCount;c++){
   const boundary=ws.getCell(r,c);boundary.border={...boundary.border,top:{style:'thin',color:{argb:'FF000000'}}};
  }
  previousDelivery=delivery;
 }
 const quantityCol=rows(s,total.r).find(c=>c.v?.formula&&/SUM\([DE]/.test(c.v.formula))?.c||4;
 // The original total label occupies three bordered blank cells; give the label their full width.
 if(!ws.getCell(total.r,1).isMerged&&quantityCol>1)ws.mergeCells(total.r,1,total.r,quantityCol-1);
 for(let c=1;c<=s.colCount;c++){const cell=ws.getCell(total.r,c);cell.border={...cell.border,top:{style:'thin',color:{argb:'FF000000'}}};}
 ws.getCell(total.r,quantityCol).value={formula:`SUM(${ws.getColumn(quantityCol).letter}8:${ws.getColumn(quantityCol).letter}${total.r-1})`,result:o.totalPieces};ws.getCell(total.r,10).value={formula:`SUM(J8:J${total.r-1})`,result:money(o.items.reduce((n,i)=>n+i.totalQuantity*i.unitPriceUSD,0))};ws.getCell('D3').value={formula:`J${total.r}`,result:o.totalAmountUSD};
 ws.getCell(total.r,quantityCol).alignment={horizontal:'right',vertical:'middle'};ws.getCell(total.r,quantityCol).numFmt='#,##0';ws.getCell(total.r,quantityCol+1).alignment={horizontal:'left',vertical:'middle'};
 for(const c of s.cells.filter(c=>c.r>=total.r&&c.v?.formula&&c.c!==quantityCol&&c.c!==10))ws.getCell(c.r,c.c).value=null;
 // Remove the preparer section and extend the adjacent approval field into
 // its space, without changing this column in the order table above.
 for(const preparer of s.cells.filter(c=>c.r>total.r&&/^[製制]\s*表\s*人\s*[:：]?$/.test(text(c.v).trim()))){
  for(let r=preparer.r;r<=s.rowCount;r++){const cell=ws.getCell(r,preparer.c);if(!cell.isMerged||cell.master.address===cell.address)cell.value=null;}
  const start=Number(ws.getCell(preparer.r,preparer.c-1).master.col);
  for(let r=preparer.r;r<=Math.min(preparer.r+1,s.rowCount);r++){
   const value=ws.getCell(r,start).value,style=clone(ws.getCell(r,start).style);
   for(const range of [...ws.model.merges]){const [a,b]=range.split(':');const first=ws.getCell(a),last=ws.getCell(b);if(Number(first.row)<=r&&Number(last.row)>=r&&Number(first.col)<=preparer.c&&Number(last.col)>=start)ws.unMergeCells(range);}
   ws.mergeCells(r,start,r,preparer.c);const cell=ws.getCell(r,start);cell.value=value;cell.style=style;cell.alignment={...cell.alignment,horizontal:'center',vertical:'middle'};
  }
 }
 return {book,sources:[t.file+' / '+s.name]};
}
export function buildReferenceDocument(data:DocumentTemplates,kind:DocumentKind,o:OrderData,refs:CsqReference[]=[],erp:ErpSnapshot|null=null,workspace?:Workspace):ReferenceWorkbook{o=sizeVariantOrder(o);if((erp||workspace)&&kind!=='overview')o=withErpPiMaterials(o,erp,workspace);const result=kind==='pi'?piDocument(data,o):kind==='quantity'?quantityDocument(data,o,refs,workspace):kind==='overview'?overviewDocument(data,o):businessDocument(data,kind,o,refs,workspace);formatDocumentText(result.book);presentWorkbook(result.book);if(kind==='overview')for(const ws of result.book.worksheets)closeOuterBorder(ws,ws.rowCount,ws.columnCount);return result;}
