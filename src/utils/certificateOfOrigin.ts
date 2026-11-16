import {packingIssues} from './shipmentPacking';
import ExcelJS from 'exceljs';
import type {Shipment,Workspace} from './workspace';
import type {OrderData} from '../types/order';
import {shipmentQuantity} from './workspace';
import {invoiceLineText} from './shippingNativeRecipes';
import {shippingMarks,automaticShippingMarks,storedLcFields,toOrderOf} from './creditLetter';
import {shippingCompany} from './shippingWorkflow';
import {presentWorkbook} from './workbookPresentation';
const compare=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
export function originRepresentativeInvoice(shipments:Shipment[]){return [...new Set(shipments.filter(s=>s.lines.some(l=>shipmentQuantity(l)>0)).map(s=>s.invoiceNo).filter(Boolean))].sort(compare.compare)[0]||'';}
function physicalCartons(s:Shipment){const ranges=new Map<string,Array<[number,number]>>();let total=0;for(const l of s.lines.filter(l=>shipmentQuantity(l)>0)){if(l.packingRows?.length)for(const b of l.packingRows)ranges.set(l.supplier,[...(ranges.get(l.supplier)||[]),[b.from,b.to]]);else total+=l.cartons;}for(const entries of ranges.values()){let start=-1,end=-1;for(const [from,to]of entries.sort((a,b)=>a[0]-b[0])){if(from>end+1){if(start>=0)total+=end-start+1;start=from;end=to;}else{if(start<0)start=from;end=Math.max(end,to);}}if(start>=0)total+=end-start+1;}return total;}
export function originShipmentDescription(raw:string,members:Shipment[]){
 const source=new Map([...raw.matchAll(/(?:^|\n)\s*([^\n]*?)\s+ORDER\s+(?:N\.?|NO\.?|NUMBER)\s*[:.]?\s*([A-Z0-9/-]+)\s+AS\s+PER\s+(?:P\/?I|P\.I\.)\s*(?:N\.?|NO\.?|NUMBER)?\s*([A-Z0-9/-]+)/gi)].map(m=>[m[2].toUpperCase(),{label:m[1].trim(),pi:m[3]}]));
 const invoices=[...new Set(members.map(s=>s.invoiceNo))].sort(compare.compare).join(', '),pos=[...new Set(members.map(s=>s.poNumber))].sort(compare.compare).join(', ');
 if(!source.size)return raw+'\nINVOICE NUMBER: '+invoices+'\nCISALFA ORDER NUMBER: '+pos;
 const summary=members.map(s=>{const entry=source.get(s.poNumber.toUpperCase());if(!entry)throw Error(s.poNumber+' 未列於信用狀 :45A，請核對此 L/C 涵蓋的訂單。');if(entry.pi.toUpperCase()!==s.scNumber.toUpperCase())throw Error(s.poNumber+' 的信用狀 P/I '+entry.pi+' 與工作站 '+s.scNumber+' 不符，請核對。');const quantities=new Map<string,number>();for(const l of s.lines){const unit=/^(PAIRS|PAIR|PRS|PR|雙)$/i.test(l.unit)?'PAIRS':/^(SETS|SET|套)$/i.test(l.unit)?'SETS':'PIECES';quantities.set(unit,(quantities.get(unit)||0)+shipmentQuantity(l));}return entry.label+' ORDER N. '+s.poNumber+' AS PER PI N. '+s.scNumber+' '+[...quantities].filter(([,q])=>q>0).map(([u,q])=>u+' '+q).join(' / ');});
 const delivery=raw.match(/DELIVERY TERMS:\s*([^\n]+)/i)?.[0];return [...summary,...(delivery?[delivery]:[]),'INVOICE NUMBER: '+invoices,'CISALFA ORDER NUMBER: '+pos].join('\n');
}
export function originCertificateData(shipments:Shipment[],orders:OrderData[],workspace:Workspace){
 const groups=new Map<string,Shipment[]>();for(const s of shipments){if(s.factoryNotice?.batchDeletedAt)continue;if(!s.lines.some(l=>shipmentQuantity(l)>0))continue;if(s.factoryNotice?.formalPackingReviewed!=='Y')throw Error(s.poNumber+'：請先核對正式裝箱資料。');const packingErrors=packingIssues(s);if(packingErrors.length)throw Error(packingErrors.join('；'));const lc=s.factoryNotice?.lcNumber?.trim();if(!lc||lc.includes(' / '))throw Error(s.poNumber+'：請先確認每張 PO 對應的一個 L/C。');groups.set(lc,[...(groups.get(lc)||[]),s]);}
 if(!groups.size)throw Error('請先讀入並核對實際裝箱數量，再產生產地證。');
 return [...groups].map(([lc,members])=>{
  const uniqueField=(key:string,tag:string)=>{const values=[...new Set(members.map(s=>s.factoryNotice?.[key]||storedLcFields(s)[tag]||'').filter(Boolean))];if(values.length!==1||members.some(s=>!(s.factoryNotice?.[key]||storedLcFields(s)[tag])))throw Error('L/C '+lc+' 的 '+':'+tag+' '+key+' 尚未填寫或同號資料不一致，請至本櫃 L/C 核對。');return values[0];};
  const consignee=toOrderOf(uniqueField('consignee','50')),sourceDescription=uniqueField('originDescription','45A'),goods=new Map<string,{description:string;hs:string;unit:string;quantity:number;styles:string[]}>();
  for(const s of members){const o=orders.find(o=>o.poNumber===s.poNumber&&o.piNumber===s.scNumber);if(!o)throw Error('缺少 '+s.poNumber+' 原始 PO。');for(const l of s.lines.filter(l=>shipmentQuantity(l)>0)){const t=invoiceLineText(s,o,l,workspace),hs=t.hs.replace(/[ .-]/g,'');if(!/^\d{6,12}$/.test(hs))throw Error(l.itemNo+'：請先補齊有效的 HS Code。');if(!t.description.trim())throw Error(l.itemNo+'：請先確認發票英文品名。');const unit=/^(PAIRS|PAIR|PRS|PR|雙)$/i.test(l.unit)?'PAIRS':/^(SET|SETS|套)$/i.test(l.unit)?'SETS':'PIECES',key=JSON.stringify([t.description.trim().replace(/\s+/g,' '),hs,unit]),prior=goods.get(key)||{description:t.description.trim(),hs,unit,quantity:0,styles:[]};prior.quantity+=shipmentQuantity(l);const style=l.itemNo.replace(/-(?:XXS|XS|S|M|L|XL|XXL|XXXL)$/,'');if(!prior.styles.includes(style))prior.styles.push(style);goods.set(key,prior);}}
  const invoice=originRepresentativeInvoice(members),representative=members.find(s=>s.invoiceNo===invoice)!,date=representative.factoryNotice?.invoiceDate||representative.date;
  if(!date)throw Error(invoice+'：請先填寫發票日期。');
  const countries=[...new Set(members.map(s=>s.factoryNotice?.destinationCountry||(/ITALY|ITALIA|GENOA|GENOVA/i.test(s.toPort+' '+s.address)?'ITALY':'')).filter(Boolean))];if(countries.length!==1)throw Error('請先確認產地證目的國。');
  return {lc,shipments:members,consignee,description:originShipmentDescription(sourceDescription,members),goods:[...goods.values()],invoice,date,country:countries[0],cartons:members.reduce((n,s)=>n+physicalCartons(s),0),marks:members.every(s=>shippingMarks(s)===automaticShippingMarks(s))&&new Set(members.map(s=>s.customer)).size===1?automaticShippingMarks(members[0]).replace('ORDER NUMBER: '+members[0].poNumber,'ORDER NUMBER: '+members.map(s=>s.poNumber).join(', ')):[...new Set(members.map(shippingMarks))].join('\n\n'),shipper:members[0].factoryNotice?.shipperAddress||shippingCompany.name+'\n'+shippingCompany.address,route:[...new Set(members.map(s=>'FROM '+s.fromPort+' TO '+s.toPort))].join('\n')+'\nBY SEA'};
 });
}
export function buildOriginCertificates(shipments:Shipment[],orders:OrderData[],workspace:Workspace){
 const groups=originCertificateData(shipments,orders,workspace),book=new ExcelJS.Workbook();book.creator='SPORTS KITE';book.calcProperties.fullCalcOnLoad=true;
 groups.forEach((g,index)=>{const ws=book.addWorksheet('CO '+(index+1),{views:[{showGridLines:false}],pageSetup:{paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:1,horizontalCentered:true,margins:{left:.3,right:.3,top:.4,bottom:.4,header:.1,footer:.1}}});ws.columns=[...Array.from({length:9},()=>({width:6})),{width:15},{width:15},{width:20}];
  const block=(r:number,c:number,endR:number,endC:number,value:ExcelJS.CellValue,bold=false,size=11)=>{if(r!==endR||c!==endC)ws.mergeCells(r,c,endR,endC);const cell=ws.getCell(r,c);cell.value=value;cell.font={name:'Calibri',size,bold};cell.alignment={vertical:'middle',wrapText:true};return cell;};
  for(let r=1;r<=11;r++)ws.getRow(r).height=20;
  block(1,1,4,6,'Exporter\n'+g.shipper);block(5,1,8,6,'Consignee\n'+g.consignee,true);block(1,7,8,12,"CERTIFICATE OF ORIGIN\nOF\nTHE PEOPLE'S REPUBLIC OF CHINA",true,16).alignment={horizontal:'center',vertical:'middle',wrapText:true};
  block(9,1,11,6,g.route,true);block(9,7,11,12,'Country of destination\n'+g.country,true);
  block(12,1,13,3,'Marks and numbers',true);block(12,4,13,9,'Description of goods',true);block(12,10,13,10,'H.S. Code',true);block(12,11,13,11,'Quantity',true);block(12,12,13,12,'Number and date\nof invoices',true);
  let r=14;const descriptionLines=g.description.split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/32)),0),descriptionHeight=Math.max(5,descriptionLines);block(r,4,r+descriptionHeight-1,9,g.description,true);block(r,12,r+3,12,g.invoice+'\n'+g.date,true);r+=descriptionHeight+1;
  for(const item of g.goods){const lines=item.description.split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/32)),0)+Math.max(1,Math.ceil(('ITEM NO. '+item.styles.join(', ')).length/32));const end=r+Math.max(3,lines)-1;block(r,4,end,9,item.description+'\nITEM NO. '+item.styles.join(', '),true);block(r,10,end,10,item.hs,true);block(r,11,end,11,item.quantity.toLocaleString('en-US')+' '+item.unit,true);r=end+2;}
  block(r,4,r+1,9,'L/C NUMBER: '+g.lc,true);r+=3;block(r,4,r+1,9,'TOTAL: '+g.cartons.toLocaleString('en-US')+' CTNS',true,13);r+=3;
  const totals=new Map<string,number>();for(const item of g.goods)totals.set(item.unit,(totals.get(item.unit)||0)+item.quantity);for(const [unit,quantity]of totals){block(r,10,r,11,quantity.toLocaleString('en-US')+' '+unit,true);r++;}
  const marksLines=g.marks.split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/18)),0);r=Math.max(r,14+Math.ceil(marksLines*14/20));block(14,1,r,3,g.marks).alignment={vertical:'top',wrapText:true};for(let row=12;row<=r;row++)ws.getRow(row).height=20;for(const row of [12,14,r+1])for(let c=1;c<=12;c++)ws.getCell(row,c).border={top:{style:'thin'}};
  ws.pageSetup.printArea='A1:L'+r;
 });presentWorkbook(book);return book;
}
