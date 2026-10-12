import {presentWorkbook} from './workbookPresentation';
import ExcelJS from 'exceljs';
import type {OrderData,OrderItem,Colorway} from '../types/order';
import {factoryDocument,chineseFactoryName} from './csqAccount';
import {findCsqReference,type CsqReference} from './csqReferences';
import {amountToEnglishWords,amountToChineseWords} from './numberToWords';
import {formatDocumentText,closeOuterBorder,fabricOnly,fabricLines,packingChinese,piShipment,piTrade,COMPANY_ENGLISH} from './documentFormatting';
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
 const candidates=list.length?list:data.templates.filter(t=>t.kind===kind&&(kind!=='factory'||t.factoryCodes.includes(o.supplierCode)));
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
function mergeItems(o:OrderData,byStyle=false){const groups=new Map<string,OrderItem>();for(const i of o.items){const key=byStyle?i.itemNo:JSON.stringify([i.itemNo,i.unitPriceUSD,i.factoryProduct?.price,!!i.isPrepack]);const prior=groups.get(key);if(!prior)groups.set(key,{...i,colors:clone(i.colors)});else {prior.totalQuantity+=i.totalQuantity;prior.colors.push(...clone(i.colors));prior.sizes=[...new Set([...prior.sizes,...i.sizes])];}}return [...groups.values()];}
function gridSizes(item:OrderItem,capacity:number){
 if(item.sizes.length<=capacity)return item.sizes;
 const active=item.sizes.filter(size=>item.colors.some(color=>(color.quantitiesBySize[size]||0)>0));
 const allocated=item.colors.reduce((n,color)=>n+Object.values(color.quantitiesBySize).reduce((sum,qty)=>sum+qty,0),0);
 if(active.length<=capacity&&allocated===item.totalQuantity)return active;
 return item.sizes;
}
function rows(s:LayoutSheet,r:number){return s.cells.filter(c=>c.r===r&&c.v!==null);}
function find(s:LayoutSheet,pattern:RegExp){return s.cells.find(c=>pattern.test(text(c.v)));}
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
 const nextAnchor=s.cells.find(c=>c.r>start&&c.c===2&&/^[A-Z][A-Z0-9-]*\d[A-Z0-9-]*$/.test(text(c.v)));const end=nextAnchor?.r||find(s,/^TOTAL:/)?.r||s.rowCount;
 const descriptionCol=kind==='pi'?4:3,sizeLine=s.cells.find(c=>c.r>start&&c.r<end&&c.c===descriptionCol&&/^(SIZE|尺寸)\s*[:：]/i.test(text(c.v)))?.r||start+2;
 set(start+1,descriptionCol,kind==='pi'?item.description:item.chineseSpec||item.description);
 for(const c of s.cells.filter(c=>c.c===descriptionCol&&c.r>start+1&&c.r<sizeLine))set(c.r,c.c,null);
 set(sizeLine,descriptionCol,`${kind==='pi'?'SIZE:':'尺寸:'} ${item.sizes.join('/ ')}`);
 if(kind==='factory')return;
 const combination=s.cells.find(c=>c.r>start&&c.r<end&&/COLOR COMBINATION/.test(text(c.v)));
 if(combination){const slots=rows(s,combination.r).filter(c=>c.c>=4).map(c=>c.c);if(item.colors.length>slots.length)throw new Error(`${item.itemNo}：P/I 範本顏色欄位不足，需加入對應 PO 的 P/I 範本。`);for(let n=0;n<slots.length;n++){const color=item.colors[n];set(combination.r,slots[n],color?.colorCode||'');set(combination.r+1,slots[n],color?.colorName||'');set(combination.r+2,slots[n],color?.totalQuantity||0);}}
 const sizeTitle=s.cells.find(c=>c.r>start&&c.r<end&&/COLOR\s*\/\s*SIZE/.test(text(c.v)));if(!sizeTitle)return;
 const sizeRow=sizeTitle.r+1,slots=rows(s,sizeRow).filter(c=>c.c>=3&&c.c<13).map(c=>c.c);const displayedSizes=gridSizes(item,slots.length);if(displayedSizes.length>slots.length)throw new Error(`${item.itemNo}：P/I 範本尺碼欄位不足，需加入對應範本。`);
 const matches=slots.map(c=>displayedSizes.find(size=>size.replace(/\s/g,'').toUpperCase()===text(rows(s,sizeRow).find(x=>x.c===c)?.v).replace(/\s/g,'').toUpperCase()));const keys=matches.some(Boolean)?matches:slots.map((_,n)=>displayedSizes[n]);for(let n=0;n<slots.length;n++)if(keys[n])set(sizeRow,slots[n],keys[n]);
 const colorRows=s.cells.filter(c=>c.c===1&&c.r>sizeRow&&c.r<end&&typeof c.v==='string'&&c.v.trim()).map(c=>c.r);if(item.colors.length>colorRows.length)throw new Error(`${item.itemNo}：P/I 範本顏色列不足，請加入對應範本。`);
 colorRows.forEach((r,n)=>{const color=item.colors[n];set(r,1,color?.colorName||'');slots.forEach((c,i)=>set(r,c,color?.quantitiesBySize[keys[i]!]||0));set(r,13,color?.totalQuantity||0);});
}
function piDocument(data:DocumentTemplates,o:OrderData):ReferenceWorkbook{
 const source=pick(data,'pi',o),book=new ExcelJS.Workbook(),items=mergeItems(o);
 const active=(item:OrderItem)=>{const sizes=item.sizes.filter(size=>item.colors.some(color=>(color.quantitiesBySize[size]||0)>0));return sizes.length?sizes:item.sizes;};
 const last=Math.max(10,...items.map(item=>active(item).length+4));
 const ws=book.addWorksheet(o.piNumber.slice(0,31),{views:[{showGridLines:false}],pageSetup:{paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0}});
 ws.columns=Array.from({length:last},(_,n)=>({width:n===0?15:n===1?16:n===2?16:n===last-1?18:n===last-2?15:12}));let r=1;
 const edge={style:'thin' as const,color:{argb:'FF000000'}};
 const put=(row:number,start:number,end:number,value:ExcelJS.CellValue,bold=false,grid=false)=>{if(end>start)ws.mergeCells(row,start,row,end);const cell=ws.getCell(row,start);cell.value=value;cell.font={name:'Calibri',size:11,bold};cell.alignment={vertical:'middle',wrapText:true,horizontal:grid?'center':typeof value==='number'||value&&typeof value==='object'&&'formula'in value?'right':'left'};if(grid)cell.border={top:edge,bottom:edge,left:edge,right:edge};return cell;};
 const row=(height=22)=>{ws.getRow(r).height=height;return r++;};
 const full=(value:string,bold=false)=>{const n=row();return put(n,1,last,value,bold);};
 const title=full(COMPANY_ENGLISH,true);title.font.size=26;title.alignment.horizontal='center';ws.getRow(1).height=38;
 const address=o.companyHeader?.address||text(source.sheet.cells.find(c=>/^7F[.,]/.test(text(c.v)))?.v);if(address)full(address).alignment.horizontal='center';
 const contact=o.companyHeader?`TEL: ${o.companyHeader.tel}   FAX: ${o.companyHeader.fax}   ${o.companyHeader.web}`:text(source.sheet.cells.find(c=>/^TEL:/.test(text(c.v)))?.v);if(contact)full(contact).alignment.horizontal='center';
 const heading=full('PROFORMA INVOICE',true);heading.font.size=20;heading.font.underline=true;heading.alignment.horizontal='center';ws.getRow(r-1).height=34;
 let n=row();put(n,1,5,`MESSRS.: ${o.customerName}`);put(n,6,last,`DATE: ${o.piDate||o.poDate}`);
 n=row();put(n,1,5,o.customerAddress);put(n,6,last,`P/I NO.: ${o.piNumber}`);
 n=row();put(n,6,last,`${o.orderingCompany||'CUSTOMER'}'S ORDER NO. ${o.poNumber}`);n=row();put(n,6,last,`CUST#: ${o.customerCode||'CSQ'}`);
 full(`PAYMENT: ${o.paymentTerms}`);n=row();put(n,2,6,o.bankInfo.beneficiary||COMPANY_ENGLISH);put(n,last-1,last,o.packingType||'NORMAL PACK',true,true);
 for(const value of [o.bankInfo.bankName,o.bankInfo.address,`ACCOUNT NO. ${o.bankInfo.accountNo}`,`SWIFT ADD: ${o.bankInfo.swiftCode}`])put(row(),2,last,value);
 full(`SHIPMENT: ${piShipment(o)}`);full(`TERMS: ${piTrade(o)}`);for(const [index,remark] of o.remarks.entries())full(`${index===0?'REMARK: ':''}${index+1}. ${remark.replace(/^\s*\d+[.)]\s*/,'')}`);
 n=row(25);put(n,1,1,'SEP.');put(n,2,3,'ITEM NO.');put(n,4,last-3,'DESCRIPTION');put(n,last-2,last-2,'QUANTITY');put(n,last-1,last-1,'UNIT PRICE');put(n,last,last,'AMOUNT');ws.getRow(n).eachCell(cell=>cell.border={top:edge,bottom:edge});
 n=row();put(n,last-2,last-2,'(PCS)');put(n,last-1,last-1,'(USD)');put(n,last,last,'(USD)');
 for(const [index,item] of items.entries()){
  n=row(25);put(n,1,1,`${index+1}.`);put(n,2,3,item.itemNo);put(n,4,last-3,item.styleName.replace(/\s*-\s*Products composition:.*$/i,''));put(n,last-2,last-2,item.totalQuantity).numFmt='#,##0';put(n,last-1,last-1,item.unitPriceUSD).numFmt='#,##0.00';put(n,last,last,{formula:`${ws.getColumn(last-2).letter}${n}*${ws.getColumn(last-1).letter}${n}`,result:money(item.totalQuantity*item.unitPriceUSD)}).numFmt='#,##0.00';
  for(const fabric of fabricLines(item.description))put(row(),4,last,fabric);
  const sizes=active(item),end=sizes.length+4;n=row(24);put(n,1,1,'COLOR CODE',true,true);put(n,2,3,'COLOR',true,true);sizes.forEach((size,i)=>put(n,i+4,i+4,size,true,true));put(n,end,end,'TTL (PCS)',true,true);
  for(const color of item.colors){n=row(24);put(n,1,1,color.colorCode,false,true);put(n,2,3,color.colorName,false,true);sizes.forEach((size,i)=>{put(n,i+4,i+4,color.quantitiesBySize[size]||0,false,true).numFmt='#,##0;-#,##0;"--"';});put(n,end,end,color.totalQuantity,false,true).numFmt='#,##0';}
  row(10);
 }
 const quantity=items.reduce((sum,item)=>sum+item.totalQuantity,0),amount=money(items.reduce((sum,item)=>sum+item.totalQuantity*item.unitPriceUSD,0));n=row(26);put(n,1,last-3,'TOTAL:',true);put(n,last-2,last-2,quantity,true).numFmt='#,##0';put(n,last-1,last-1,'USD');put(n,last,last,amount,true).numFmt='#,##0.00';ws.getRow(n).eachCell(cell=>cell.border={top:edge,bottom:{style:'double',color:edge.color}});
 full(amountToEnglishWords(amount).toUpperCase());row(24);n=row();put(n,1,5,o.customerName,true);put(n,6,last,COMPANY_ENGLISH,true);row(28);n=row();put(n,1,5,'(PLEASE KINDLY SIGN BACK, THANKS!!)');put(n,6,last,`(Manager Director: ${o.companyHeader?.managerDirector||'Giant Kao'})`);
 ws.pageSetup.printArea=`A1:${ws.getColumn(last).letter}${r-1}`;return {book,sources:[source.file]};
}
function businessDocument(data:DocumentTemplates,kind:'pi'|'factory',order:OrderData,refs:CsqReference[]):ReferenceWorkbook{
 const o=kind==='factory'?factoryDocument(order,refs):order;if(kind==='factory'&&(!o.factorySupplier||o.items.some(i=>(o.factoryCurrency==='USD'?i.factoryUnitPriceUSD||0:i.unitPriceRMB)<=0)))throw new Error('請先確認並帶入 ERP 工廠與採購單價，再預覽或匯出採購單。');const t=pick(data,kind,o);const items=mergeItems(o);data={...data,styles:[...data.styles]};const s=t.sheet;
 const anchors=s.cells.filter(c=>c.c===2&&c.r>15&&/^[A-Z][A-Z0-9-]*\d[A-Z0-9-]*$/.test(text(c.v))).sort((a,b)=>a.r-b.r);
 const total=find(s,kind==='pi'?/^TOTAL:/:/^合\s*計\s*[:：]/);if(!anchors.length||!total)throw new Error('這份文件範本的品項區需另行設定，請選擇可用的範本。');
 const selected=items.map(i=>anchors.find(a=>text(a.v)===i.itemNo)||anchors[0]);
 const fees=kind==='factory'?(o.factoryExtraFees||[]).filter(f=>f.amount!==0||f.description.trim()):[];
 if(fees.some(f=>!f.description.trim()||!Number.isFinite(f.amount)||f.amount<0))throw new Error('請填寫額外費用名稱與有效金額（不可小於 0）。');
 if(kind==='factory'&&o.hasDeposit&&(!(o.depositPercent!>0)||o.depositPercent!>100))throw new Error('請填寫 0 至 100% 之間的訂金比例。');
 const segments=[{start:1,end:anchors[0].r-1},...selected.map(a=>({start:a.r,end:anchors.find(next=>next.r>a.r)?.r?anchors.find(next=>next.r>a.r)!.r-1:total.r-1})),...(fees.length?Array.from({length:fees.length+1},()=>({start:total.r,end:total.r})):[]),{start:total.r,end:s.rowCount}];
 const transformed=remap(s,segments);const book=new ExcelJS.Workbook();const ws=materialize(book,transformed.sheet,data,o.piNumber);
 if(kind==='factory')items.forEach((i,n)=>mapBlock(ws,s,selected[n].r,transformed.starts[n+1],i,o,kind,n));
 const footer=transformed.starts.at(-1)!;const subtotal=money(items.reduce((n,i)=>n+i.totalQuantity*(kind==='pi'?i.unitPriceUSD:o.factoryCurrency==='USD'?i.factoryUnitPriceUSD||0:i.unitPriceRMB),0)),amount=money(subtotal+fees.reduce((sum,f)=>sum+f.amount,0)),quantity=items.reduce((n,i)=>n+i.totalQuantity,0);
 ws.getCell(footer,kind==='pi'?15:7).value=quantity;ws.getCell(footer,kind==='pi'?19:9).value=amount;
 const sourceText=(pattern:RegExp,value:string)=>{for(const c of transformed.sheet.cells.filter(c=>pattern.test(text(c.v)))){const cell=ws.getCell(c.r,c.c);if(!cell.isMerged||cell.master.address===cell.address)cell.value=value;}};
 if(kind==='pi'){
  ws.getCell('B7').value=o.customerName;sourceText(/^DATE:/,`DATE: ${o.piDate||o.poDate}`);sourceText(/^P\/I NO\./,`P/I NO.: ${o.piNumber}`);sourceText(/ORDER NO\./,`${o.orderingCompany||'CUSTOMER'}'S ORDER NO.${o.poNumber}`);sourceText(/^PAYMENT:/,`PAYMENT: ${o.paymentTerms}`);sourceText(/^SHIPMENT:/,`SHIPMENT: ${piShipment(o)}`);sourceText(/^TERMS:/,`TERMS: ${piTrade(o)}`);sourceText(/^(NORMAL|MULTIPLE) PACK$/,o.packingType||'NORMAL PACK');
  sourceText(/^ACCOUNT NO\./,`ACCOUNT NO. ${o.bankInfo.accountNo}`);sourceText(/^SWIFT ADD:/,`SWIFT ADD: ${o.bankInfo.swiftCode}`);sourceText(/^MEGA INTERNATIONAL/,o.bankInfo.bankName);ws.getCell(footer+1,1).value=amountToEnglishWords(amount).toUpperCase();
  for(const c of transformed.sheet.cells.filter(c=>c.r>footer&&c.c===1&&text(c.v)===text(rows(s,7).find(x=>x.c===2)?.v)))ws.getCell(c.r,c.c).value=o.customerName;
 }else{
  const supplierName=chineseFactoryName(o.factorySupplier),currency=o.factoryCurrency||'RMB';
  const supplier=setField(ws,s,/供\s*[應应]\s*商\s*[:：]/,supplierName);
  setField(ws,s,/採\s*購\s*日\s*期\s*[:：]/,o.piDate||o.poDate);
  setField(ws,s,/採\s*購\s*單\s*[號号]\s*[:：]/,o.piNumber);
  setField(ws,s,/客\s*人\s*訂\s*單\s*[:：]/,o.poNumber);
  setField(ws,s,/供\s*[應应]\s*商\s*[號号]\s*[:：]/,o.supplierCode);
  const deposit=money(amount*(o.depositPercent||0)/100);
  const payment=setField(ws,s,/付\s*款\s*方\s*式\s*[:：]/,`${o.factoryTerms}${o.hasDeposit?`\n訂金 ${o.depositPercent}%：${currency} ${deposit.toFixed(2)}；餘款：${currency} ${money(amount-deposit).toFixed(2)}。訂金依採購總額（含額外費用）計算。`:''}`);
  if(payment){const continuation=rows(s,payment.r+1);if(!continuation.some(c=>c.c===1&&text(c.v).trim()))for(const c of continuation.filter(c=>c.c===2&&typeof c.v==='string'))ws.getCell(c.r,c.c).value='';}
  setField(ws,s,/交\s*貨\s*地\s*點\s*[:：]/,o.deliveryPlace);
  setField(ws,s,/交\s*貨\s*日\s*期\s*[:：]/,o.factoryShipDate);
  setField(ws,s,/交\s*易\s*條\s*件\s*[:：]/,o.tradeTerms);
  const pack=find(transformed.sheet,/^(NORMAL|MULTIPLE) PACK$|^單碼包裝$|^混碼包裝$/);
  if(pack)ws.getCell(pack.r,pack.c).value=packingChinese(o);
  else {const blankRow=s.rows.findIndex((_,index)=>index>=2&&index<anchors[0].r-1&&!rows(s,index+1).some(c=>text(c.v).trim()))+1;if(blankRow>0){if(!ws.getCell(blankRow,1).isMerged)ws.mergeCells(blankRow,1,blankRow,s.colCount);ws.getCell(blankRow,1).value=packingChinese(o);ws.getCell(blankRow,1).alignment={horizontal:'right'};}}
  if(fees.length){const start=transformed.starts[items.length+1];ws.getCell(start,1).value='貨款小計：';ws.getCell(start,7).value=quantity;ws.getCell(start,8).value=currency;ws.getCell(start,9).value=subtotal;fees.forEach((fee,index)=>{const r=start+index+1;ws.getCell(r,1).value=`額外費用：${fee.description}`;ws.getCell(r,7).value=null;ws.getCell(r,8).value=currency;ws.getCell(r,9).value=money(fee.amount);});ws.getCell(footer,1).value='採購總額：';}
  sourceText(/^\((USD|RMB|人民币|人民幣|美金)\/(件|雙|双)\)$/,`(${o.factoryCurrency||'RMB'}/${o.factoryQuantityUnit||'件'})`);sourceText(/^\((人民币|人民幣|美金|USD|RMB)\)$/,`(${o.factoryCurrency||'RMB'})`);sourceText(/^\((件|雙|双)\)$/,`(${o.factoryQuantityUnit||'件'})`);ws.getCell(footer,8).value=o.factoryCurrency||'RMB';ws.getCell(footer+1,2).value=amountToChineseWords(amount).replace(/^人民幣/,o.factoryCurrency==='USD'?'美金':'人民幣');
  const oldSupplier=supplier?text(rows(s,supplier.r).find(c=>c.c===supplier.c+1)?.v).trim():'';if(oldSupplier)sourceText(new RegExp(`^${oldSupplier.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`),supplierName);
 }
 return {book,sources:[t.file]};
}
function quantityDocument(data:DocumentTemplates,o:OrderData,refs:CsqReference[]):ReferenceWorkbook{
 const book=new ExcelJS.Workbook(),sources:string[]=[];
 for(const item of mergeItems(o,true)){
  const t=pick(data,'quantity',o,item),s=t.sheet,ref=findCsqReference(item.itemNo,o.poNumber,refs),ws=book.addWorksheet(item.itemNo.slice(0,31),{pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0},views:[{showGridLines:false}]});sources.push(t.file+' / '+s.name);
  const colors=new Map<string,Colorway>();for(const color of item.colors){const prior=colors.get(color.colorCode);if(!prior)colors.set(color.colorCode,clone(color));else{prior.totalQuantity+=color.totalQuantity;for(const [size,qty] of Object.entries(color.quantitiesBySize))prior.quantitiesBySize[size]=(prior.quantitiesBySize[size]||0)+qty;}}
  const sizes=item.sizes.filter(size=>[...colors.values()].some(color=>(color.quantitiesBySize[size]||0)>0));const keys=sizes.length?sizes:item.sizes;const last=keys.length+3;
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
  infoFull('品名：',ref?.name||item.chineseName||item.styleName.replace(/\s*-\s*Products composition:.*$/i,''));
  const fabrics=fabricLines(ref?.spec||item.chineseSpec||item.description);for(const [n,fabric] of fabrics.entries())infoFull(`面料${fabrics.length>1?` ${n+1}`:''}：`,fabric);
  const pack=infoPair('數量：',`${item.totalQuantity.toLocaleString('en-US')} ${o.factoryQuantityUnit||'件'}`,'包裝方式：',packingChinese(o,true));const packCell=ws.getCell(pack,last>=4?split+2:2);packCell.font={...packCell.font,bold:true};packCell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFFF99'}};
  const tableRow=(values:ExcelJS.CellValue[],bold=false)=>{const row=ws.getRow(r++);row.values=values;row.height=25;row.eachCell(cell=>{cell.font={size:11,bold};cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};cell.border={top:edge,bottom:edge,left:edge,right:edge};cell.numFmt='#,##0;-#,##0;"--"';});return row;};
  const header=tableRow(['色碼','色名',...keys,`合計（${o.factoryQuantityUnit||'件'}）`],true);header.eachCell(cell=>cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F3F2'}});
  const colorStart=r;for(const color of colors.values())tableRow([color.colorCode,color.colorName,...keys.map(size=>color.quantitiesBySize[size]||0),color.totalQuantity]);
  const totalRow=tableRow(['合計','',...keys.map((size,n)=>({formula:`SUM(${ws.getColumn(n+3).letter}${colorStart}:${ws.getColumn(n+3).letter}${r-1})`,result:[...colors.values()].reduce((sum,color)=>sum+(color.quantitiesBySize[size]||0),0)})),{formula:`SUM(${ws.getColumn(last).letter}${colorStart}:${ws.getColumn(last).letter}${r-1})`,result:item.totalQuantity}],true);ws.mergeCells(totalRow.number,1,totalRow.number,2);
  const oldTotal=find(s,/^合\s*[計计]$/);const notes=s.cells.filter(c=>typeof c.v==='string'&&oldTotal&&c.r>oldTotal.r&&!/包裝方式|包装方式|注意单色|注意單色/.test(c.v)).map(c=>text(c.v));
  for(const note of [...new Set(notes)])full(note.replace(/单色单码|單色單碼|单色混码|單色混碼/g,o.packingType==='MULTIPLE PACK'?'單色混碼':'單色單碼'));
  const measurementRows=[...new Set(s.cells.filter(c=>typeof c.v==='string'&&/^(尺寸|重量)$/.test(c.v.trim())).map(c=>c.r))];for(const row of measurementRows)full(`參考${rows(s,row).map(c=>text(c.v)).filter(Boolean).join('／')}`);
  ws.pageSetup.printArea=`A1:${ws.getColumn(last).letter}${r-1}`;
 }
 return {book,sources};
}
function overviewDocument(data:DocumentTemplates,o:OrderData):ReferenceWorkbook{
 const t=pick(data,'overview',o),s=t.sheet,book=new ExcelJS.Workbook(),ws=materialize(book,s,data,o.piNumber);const total=find(s,/^GRAND TOTAL:/);if(!total)throw new Error('早見表範本缺少總計列');
 const sourceItems=s.cells.filter(c=>c.c===2&&c.r>7&&c.r<total.r&&/^[A-Z][A-Z0-9-]*\d[A-Z0-9-]*$/.test(text(c.v)));const items=mergeItems(o);
 if(items.length>sourceItems.length)throw new Error('早見表品項超過目前範本列數，請加入對應訂單 sheet。');
 ws.getCell('D1').value=o.customerName;ws.getCell('J1').value=o.piNumber;ws.getCell('J2').value=o.piNumber;ws.getCell('D2').value=dateValue(o.poDate);ws.getCell('J3').value=o.poNumber;ws.getCell('D5').value=o.paymentTerms;ws.getCell('J5').value=o.tradeTerms;ws.getCell('D6').value=dateValue(o.shipmentDate);ws.getCell('J6').value=o.packingType||'NORMAL PACK';
 const sectionRows=s.cells.filter(c=>c.c===1&&c.r>=8&&c.r<total.r&&/^CS\d/.test(text(c.v)));
 const matchingSection=sectionRows.find(c=>text(c.v).includes(o.piNumber));const nextSection=sectionRows.find(c=>matchingSection&&c.r>matchingSection.r);
 const preferred=matchingSection?sourceItems.filter(c=>c.r>matchingSection.r&&c.r<(nextSection?.r||total.r)):sourceItems;
 const destinations=[...preferred,...sourceItems.filter(c=>!preferred.includes(c))],usedRows=new Set<number>();
 // Remove vertical factory merges before hiding unused template rows.
 for(const range of [...ws.model.merges]){const [start,end]=range.split(':');const first=ws.getCell(start),last=ws.getCell(end);if(Number(first.row)>=8&&Number(last.row)<total.r&&first.row!==last.row)ws.unMergeCells(range);}
 for(let r=8;r<total.r;r++)for(let c=1;c<=s.colCount;c++)if(!ws.getCell(r,c).isMerged||ws.getCell(r,c).master.address===ws.getCell(r,c).address)ws.getCell(r,c).value=null;
 // Reference sheets contain separators for orders that are cleared above.
 // Keep this item's area open; the header, grand total and outer frame remain.
 for(let r=8;r<total.r;r++)for(let c=1;c<=s.colCount;c++)ws.getCell(r,c).border={};
 if(matchingSection)ws.getCell(matchingSection.r,1).value=o.piNumber;
 items.forEach((i,n)=>{const original=preferred.find(c=>text(c.v)===i.itemNo&&!usedRows.has(c.r))||destinations.find(c=>!usedRows.has(c.r))!;const r=original.r;usedRows.add(r);const values=rows(s,r);
  const quantity=values.find(c=>typeof c.v==='number'&&c.c>=4&&c.c<=5)?.c||4;const price=values.find(c=>typeof c.v==='number'&&c.c>=7&&c.c<=8)?.c||7;
  const unit=text(values.find(c=>c.c===quantity+1)?.v)||'PCS';
  ws.getCell(r,1).value=n+1;ws.getCell(r,2).value=i.itemNo;ws.getCell(r,quantity).value=i.totalQuantity;ws.getCell(r,quantity+1).value=unit;ws.getCell(r,price-1).value='@';ws.getCell(r,price).value=i.unitPriceUSD;ws.getCell(r,9).value='USD';ws.getCell(r,10).value={formula:`${ws.getColumn(quantity).letter}${r}*${ws.getColumn(price).letter}${r}`,result:money(i.totalQuantity*i.unitPriceUSD)};ws.getCell(r,11).value=`${i.factoryProduct?.supplierCode||'待確認'}\n${o.factoryShipDate}`;
 });
 for(let r=8;r<total.r;r++){const row=ws.getRow(r);row.hidden=!usedRows.has(r)&&r!==matchingSection?.r;row.height=usedRows.has(r)?24:20;}
 // Display each factory/deadline once in physical row order.
 const shownDeliveries=new Set<string>();for(const r of [...usedRows].sort((a,b)=>a-b)){const cell=ws.getCell(r,11),delivery=cell.text;if(shownDeliveries.has(delivery))cell.value=null;else shownDeliveries.add(delivery);}
 const quantityCol=rows(s,total.r).find(c=>c.v?.formula&&/SUM\([DE]/.test(c.v.formula))?.c||4;
 // The original total label occupies three bordered blank cells; give the label their full width.
 if(!ws.getCell(total.r,1).isMerged&&quantityCol>1)ws.mergeCells(total.r,1,total.r,quantityCol-1);
 for(let c=1;c<=s.colCount;c++){const cell=ws.getCell(total.r,c);cell.border={...cell.border,top:{style:'thin',color:{argb:'FF000000'}}};}
 ws.getCell(total.r,quantityCol).value={formula:`SUM(${ws.getColumn(quantityCol).letter}8:${ws.getColumn(quantityCol).letter}${total.r-1})`,result:o.totalPieces};ws.getCell(total.r,10).value={formula:`SUM(J8:J${total.r-1})`,result:money(o.items.reduce((n,i)=>n+i.totalQuantity*i.unitPriceUSD,0))};ws.getCell('D3').value={formula:`J${total.r}`,result:o.totalAmountUSD};
 for(const c of s.cells.filter(c=>c.r>=total.r&&c.v?.formula&&c.c!==quantityCol&&c.c!==10))ws.getCell(c.r,c.c).value=null;
 const signature=s.cells.find(c=>c.r>total.r&&typeof c.v==='string'&&/JASMINE|Daisy|Sufei/.test(c.v));if(signature)ws.getCell(signature.r,signature.c).value='';
 return {book,sources:[t.file+' / '+s.name]};
}
export function buildReferenceDocument(data:DocumentTemplates,kind:DocumentKind,o:OrderData,refs:CsqReference[]=[]):ReferenceWorkbook{const result=kind==='pi'?piDocument(data,o):kind==='quantity'?quantityDocument(data,o,refs):kind==='overview'?overviewDocument(data,o):businessDocument(data,kind,o,refs);formatDocumentText(result.book);presentWorkbook(result.book);if(kind==='overview')for(const ws of result.book.worksheets)closeOuterBorder(ws,ws.rowCount,ws.columnCount);return result;}
