import {lcForLine} from './shipmentLc';
import {shippingDescription} from './shippingDescription';
import type {OrderData} from '../types/order';
import {shipmentQuantity,type Shipment,type ShipmentLine,type Workspace} from './workspace';
import {packingIssues,cartonCount} from './shipmentPacking';
import {shippingCompany,shippingInvoiceAmounts,shipmentEstimates} from './shippingWorkflow';
import {amountToEnglishWords} from './numberToWords';
import {shipmentTrackingData} from './shipmentTracking';
import type {TrackingRecord} from './workspace';
type Scalar=string|number|null;
type Patch=[string,Scalar];
export interface NativeShippingSheet {name:string;patches:Patch[];formulas:[string,string][];insertColumns?:{at:number;count:number}[];body?:{start:number;end:number;columns:number;rows:{source:number;values:Scalar[]}[]}}
export interface NativeShippingRecipe {template:string;sheets:NativeShippingSheet[]}
const sum=(lines:ShipmentLine[],key:'cartons'|'netWeight'|'grossWeight'|'cbm')=>lines.reduce((n,l)=>n+l[key],0);
const blank=(n:number)=>Array<Scalar>(n).fill(null);
const col=(n:number)=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
function sourceItem(s:Shipment,o:OrderData,l:ShipmentLine){return o.items.find(i=>l.id.startsWith(i.id+':'))||o.items.find(i=>i.itemNo===l.itemNo);}
export function invoiceLineText(s:Shipment,o:OrderData,l:ShipmentLine){
 const f=s.factoryNotice||{},item=sourceItem(s,o,l),composition=f['composition:'+l.itemNo]||item?.composition||item?.description||'',description=f['invoiceDescription:'+l.itemNo]||shippingDescription(s,l,o)||l.description;
 return {composition,description,hs:f['hsCode:'+l.itemNo]||''};
}
function colorParts(s:Shipment,o:OrderData,l:ShipmentLine){const c=sourceItem(s,o,l)?.colors.find(c=>`${c.colorCode} ${c.colorName}`.trim()===l.color.trim());if(c)return [c.colorCode,c.colorName];const n=l.color.indexOf(' ');return n<0?['',l.color]:[l.color.slice(0,n),l.color.slice(n+1)];}
export function cartonPack(s:Shipment,l:ShipmentLine,from:number,to:number){
 try{const entry=JSON.parse(s.factoryNotice?.standardPacking||'{}')[JSON.stringify([l.id,from,to])];if(entry?.mode==='MULTIPLE PACK'&&Number.isInteger(entry.packs)&&entry.packs>0)return {multiple:true,packs:entry.packs};}catch{/* Old manual cartons remain single pack until reviewed. */}
 return {multiple:false,packs:0};
}
function assertCustomer(s:Shipment,o:OrderData){if(o.packingType==='MULTIPLE PACK'){let modes:Record<string,{mode:string}>={};try{modes=JSON.parse(s.factoryNotice?.standardPacking||'{}');}catch{/* handled by missing row check */}if(s.lines.some(l=>(l.packingRows||[]).some(b=>!['NORMAL PACK','MULTIPLE PACK'].includes(modes[JSON.stringify([l.id,b.from,b.to])]?.mode))))throw Error('混碼訂單請先讀入標準清單，逐箱確認包裝方式與配比。');}const errors=packingIssues(s);if(errors.length)throw Error(errors.join('；'));if(!s.lines.some(l=>shipmentQuantity(l)>0))throw Error('請先核對正式裝箱資料。');if(s.factoryNotice?.formalPackingReviewed!=='Y')throw Error('請先在「正式裝箱核對」確認資料，再匯出客戶文件。');if(s.lines.some(l=>shipmentQuantity(l)>0&&!(l.unitPriceUSD>0)))throw Error('客戶單價尚未確認。');if(!s.invoiceNo||!s.customer)throw Error('請填發票號碼及客戶。');if(!/CISALFA/i.test(o.orderingCompany||o.customerName))for(const l of s.lines.filter(l=>shipmentQuantity(l)>0)){const text=invoiceLineText(s,o,l).description;if(!/\b(?:MEN['’]S|WOMEN['’]S|YOUTH|BOYS|GIRLS|UNISEX)\b/i.test(text)||!/%/.test(text)||!/(KNITTED|WOVEN)/i.test(text))throw Error(`${l.itemNo}：請確認英文發票品名包含性別、成分與 KNITTED／WOVEN。`);}}
export function cisalfaShippingRecipe(s:Shipment,o:OrderData,w:Workspace):NativeShippingRecipe{
 assertCustomer(s,o);const lines=s.lines.filter(l=>shipmentQuantity(l)>0),f=s.factoryNotice||{},allPacks=lines.reduce((n,l)=>n+(l.packingRows||[]).reduce((n,b)=>n+cartonPack(s,l,b.from,b.to).packs*cartonCount(b),0),0),totals={qty:lines.reduce((n,l)=>n+shipmentQuantity(l),0),ctns:sum(lines,'cartons'),gw:sum(lines,'grossWeight'),nw:sum(lines,'netWeight'),cbm:sum(lines,'cbm')},amounts=shippingInvoiceAmounts(s,o,w);
 const invoice:NativeShippingSheet={name:'Invoice',patches:[],formulas:[],body:{start:2,end:f._cisSourceEnd?Number(f._cisSourceEnd):2,columns:40,rows:[]}},packing:NativeShippingSheet={name:'PackingList',patches:[],formulas:[],body:{start:2,end:2,columns:23,rows:[]}},weight:NativeShippingSheet={name:'WeightList',patches:[],formulas:[],body:{start:2,end:2,columns:20,rows:[]}};
 // end=- handled by server catalog so source rows can never leak into a new export.
 for(const l of lines){const [code,color]=colorParts(s,o,l),text=invoiceLineText(s,o,l),qty=shipmentQuantity(l),packs=(l.packingRows||[]).reduce((n,b)=>n+cartonPack(s,l,b.from,b.to).packs*cartonCount(b),0),v=blank(40),r=invoice.body!.rows.length+2;
  Object.assign(v,{0:shippingCompany.name,1:shippingCompany.address,2:s.invoiceNo,3:s.invoiceNo,4:f.invoiceDate||s.date||'',5:s.scNumber,7:lcForLine(s,l.id),9:o.paymentTerms,10:f.payment||'L/C',11:f.shipmentMode||'BY SEA',12:f.incoterms||'FOB',13:s.fromPort,14:f.etd||s.date,15:totals.ctns,16:totals.qty,17:'USD',18:amounts.gross,21:'CHINA',22:1,23:1,24:1,26:s.poNumber,27:l.itemNo,28:packs?1:0,29:code,30:color,31:text.composition,32:text.description,33:text.hs,34:l.cartons,35:qty,36:'PZ',37:l.unitPriceUSD,38:0});
  invoice.body!.rows.push({source:2,values:v});invoice.formulas.push([`AN${r}`,`=ROUND(AJ${r}*AL${r}*(1-AM${r}/100),2)`]);
  const wv:Scalar[]=[shippingCompany.name,s.invoiceNo,s.invoiceNo,allPacks||null,totals.ctns,totals.qty,totals.gw,totals.nw,totals.cbm,s.poNumber,l.itemNo,code,color,packs||null,l.cartons,qty,l.grossWeight,l.netWeight,l.cbm,s.container];weight.body!.rows.push({source:2,values:wv});
  for(const b of l.packingRows||[]){const pack=cartonPack(s,l,b.from,b.to),perBox=Object.values(b.sizes).reduce((a,v)=>a+v,0),perPack=pack.multiple?perBox/pack.packs:0;if(pack.multiple&&(!Number.isInteger(perPack)||Object.values(b.sizes).some(v=>!Number.isInteger(v/pack.packs))))throw Error(`${l.itemNo}：混碼每包配比與箱內件數不一致。`);
   for(const [size,q]of Object.entries(b.sizes).filter(([,q])=>q>0)){const r=packing.body!.rows.length+2,v:Scalar[]=[shippingCompany.name,s.invoiceNo,s.invoiceNo,s.container,qty,l.cartons,l.grossWeight,l.netWeight,l.cbm,s.poNumber,l.itemNo,text.description,b.from,b.to,pack.multiple?perPack:null,pack.multiple?null:perBox,pack.multiple?pack.packs*cartonCount(b):null,cartonCount(b),perBox*cartonCount(b),size,q*cartonCount(b),code,color];packing.body!.rows.push({source:2,values:v});packing.formulas.push([`R${r}`,`=N${r}-M${r}+1`],[`S${r}`,pack.multiple?`=O${r}*Q${r}`:`=P${r}*R${r}`]);}
  }
 }
 return {template:allPacks?'cisalfa-multiple':'cisalfa-single',sheets:[invoice,packing,weight]};
}
export function factoryPackingRecipe(s:Shipment,o:OrderData,kind:'estimate'|'actual'='actual'):NativeShippingRecipe{
 const sheet:NativeShippingSheet={name:'工廠裝箱明細',patches:[['B4',s.scNumber],['E4',s.poNumber],['H4',[...new Set(s.lines.map(l=>l.supplier))].join(' / ')],['K4',kind==='estimate'?'預估清單':'正式裝箱']],formulas:[],body:{start:7,end:206,columns:21,rows:[]}};
 for(const l of s.lines){const [code,color]=colorParts(s,o,l),boxes=l.packingRows?.length?l.packingRows:[null];for(const b of boxes){const pack=b?cartonPack(s,l,b.from,b.to):{multiple:o.packingType==='MULTIPLE PACK',packs:0},dimensions=b?.measurement.match(/[\d.]+/g)?.slice(0,3).map(Number)||[];for(const size of Object.keys(l.sizes)){const r=sheet.body!.rows.length+7,v=blank(21),item=sourceItem(s,o,l),ratio=item?.colors.find(c=>c.colorCode===code)?.ratioBySize?.[size];Object.assign(v,{0:b?.from||null,1:b?.to||null,2:l.itemNo,3:code,4:color,5:pack.multiple?'MULTIPLE PACK':'NORMAL PACK',6:size,7:b?(pack.multiple?(b.sizes[size]||0)/pack.packs:b.sizes[size]||0):ratio??null,8:pack.packs||null,12:b?.netWeight||null,13:b?.grossWeight||null,14:dimensions[0]||null,15:dimensions[1]||null,16:dimensions[2]||null});sheet.body!.rows.push({source:7,values:v});const active=`AND(ISNUMBER(A${r}),ISNUMBER(B${r}),C${r}<>"",G${r}<>"")`,first=`COUNTIFS($A$7:A${r},A${r},$B$7:B${r},B${r},$C$7:C${r},C${r},$D$7:D${r},D${r})=1`;for(const [c,formula]of Object.entries({J:`IF(F${r}="MULTIPLE PACK",H${r}*I${r},H${r})`,K:`IF(${first},B${r}-A${r}+1,0)`,L:`(B${r}-A${r}+1)*J${r}`,R:`O${r}*P${r}*Q${r}/1000000`,S:`K${r}*R${r}`,T:`K${r}*M${r}`,U:`K${r}*N${r}`}))sheet.formulas.push([c+r,`=IF(${active},${formula},"")`]);}}}
 while(sheet.body!.rows.length<200){const r=sheet.body!.rows.length+7;sheet.body!.rows.push({source:7,values:blank(21)});const active=`AND(ISNUMBER(A${r}),ISNUMBER(B${r}),C${r}<>"",G${r}<>"")`,first=`COUNTIFS($A$7:A${r},A${r},$B$7:B${r},B${r},$C$7:C${r},C${r},$D$7:D${r},D${r})=1`;for(const [c,formula]of Object.entries({J:`IF(F${r}="MULTIPLE PACK",H${r}*I${r},H${r})`,K:`IF(${first},B${r}-A${r}+1,0)`,L:`(B${r}-A${r}+1)*J${r}`,R:`O${r}*P${r}*Q${r}/1000000`,S:`K${r}*R${r}`,T:`K${r}*M${r}`,U:`K${r}*N${r}`}))sheet.formulas.push([c+r,`=IF(${active},${formula},"")`]);}
 return {template:'factory-packing',sheets:[sheet]};
}
export function customerShippingRecipe(s:Shipment,o:OrderData,w:Workspace):NativeShippingRecipe{
 if(/CISALFA/i.test(o.orderingCompany||o.customerName))return cisalfaShippingRecipe(s,o,w);
 assertCustomer(s,o);
 const company=(o.orderingCompany||o.customerName).toUpperCase(),falis=company.includes('FALIS'),premium=company.includes('PREMIUM');
 if(!falis&&!premium&&!company.includes('MEDICO'))throw Error('此下單公司尚未核對指定原表，未套用其他公司的格式。');
 const lines=s.lines.filter(l=>shipmentQuantity(l)>0),f=s.factoryNotice||{},amounts=shippingInvoiceAmounts(s,o,w),medical=!falis,multiPK=medical&&lines.some(l=>(l.packingRows||[]).some(b=>cartonPack(s,l,b.from,b.to).multiple)),singleMedical=medical&&!multiPK;
 const start=medical?23:21,end=medical?(singleMedical?33:34):51,invoice:NativeShippingSheet={name:'INVOICE',patches:[['A1',shippingCompany.name],['A2',shippingCompany.address],['A3',shippingCompany.contact],['A7','INVOICE NO. : '+s.invoiceNo],['A8','P/I NO. '+s.scNumber],['H7',null],['H8','DATE: '+(f.invoiceDate||s.date)],['A9',medical?'MESSRS. : '+s.customer:'MESSRS. :'],['B10',s.address.split('\n')[0]||''],['B11',s.address.split('\n')[1]||'']],formulas:[],body:{start,end,columns:9,rows:[]}};
 if(falis)invoice.patches.push(['B9',s.customer]);else invoice.patches.push(['B12',s.address.split('\n').slice(2).join('\n')]);
 invoice.patches.push([`A${medical?14:13}`,'VESSEL: '+s.vessel],[`A${medical?15:14}`,'SAILING ON/ABOUT: '+(f.etd||s.date)],[`A${medical?16:15}`,`SHIPMENT: FROM ${s.fromPort} TO ${s.toPort}`],[`A${medical?21:19}`,`ORDER NO. ${s.poNumber} AS PER P/I ${s.scNumber}`],[`A${medical?22:20}`,`DELIVERY TERMS: ${f.incoterms||'FOB'} ${s.fromPort}`]);
 if(medical)invoice.patches.push(['A17','TERM OF PAYMENT : '+o.paymentTerms]);
 const add=(source:number,values:Scalar[])=>{const r=start+invoice.body!.rows.length;invoice.body!.rows.push({source,values});return r;};
 add(start,[`P/I NO. ${s.scNumber}, ORDER NUMBER ${s.poNumber}`,null,null,null,null,null,null,'FOB '+s.fromPort]);
 const amountsRows:number[]=[];
 for(const l of lines){const desc=blank(9);desc[0]=l.itemNo;desc[2]=invoiceLineText(s,o,l).description;add(start+1,desc);const v=blank(9);Object.assign(v,{2:'COLOR: '+l.color,5:shipmentQuantity(l),6:l.unit==='PAIRS'?'PAIRS':'PIECES',7:l.unitPriceUSD});const r=add(start+2,v);invoice.formulas.push([`I${r}`,`=ROUND(F${r}*H${r},2)`]);amountsRows.push(r);}
 const total=add(medical?28:49,['TOTAL:',null,null,null,null,null,'PIECES','USD']);invoice.formulas.push([`F${total}`,`=SUM(F${start}:F${total-1})`],[`I${total}`,`=SUM(I${start}:I${total-1})`]);
 if(medical){const deposit=add(29,[null,null,null,null,null,null,null,'MINUS: 30% DEPOSIT',-amounts.deposit]);let discount=0;if(!premium){discount=add(30,[null,null,null,null,null,null,null,'MINUS: 1% DISCOUNT']);invoice.formulas.push([`I${discount}`,`=-ROUND(I${total}*1%,2)`]);}const net=add(31,[null,null,null,null,null,null,null,'TOTAL:']);invoice.formulas.push([`I${net}`,`=SUM(I${total}:I${discount||deposit})`]);}
 add(medical?32:50,[amountToEnglishWords(amounts.net)]);add(medical?(singleMedical?33:34):51,[]);
 const delta=invoice.body!.rows.length-(end-start+1);
 if(medical)invoice.patches.push([`A${(singleMedical?34:35)+delta}`,'*** PAYMENT DUE DATE : '+(f.paymentDueDate||f.etd||s.date)+' ***'],[`A${(singleMedical?46:47)+delta}`,`THAT GOODS SHIPPED ARE ACCORDING TO PI NO. ${s.scNumber} DATED ${o.poDate||''}`],[`A${(singleMedical?57:58)+delta}`,f.shippingMarks||s.customer]);
 else invoice.patches.push([`A${52+delta}`,'L/C NO. '+(f.lcNumber||'')],[`A${53+delta}`,'ISSUE DATE: '+(f.lcIssueDate||'')],[`A${54+delta}`,'ISSUE BANK: '+(f.lcIssueBank||'')],[`A${57+delta}`,`THAT GOODS SHIPPED ARE ACCORDING TO PI NO. ${s.scNumber} DATED ${o.poDate}`],[`A${68+delta}`,f.shippingMarks||s.customer]);
 const sizes=[...new Set(lines.flatMap(l=>Object.keys(l.sizes)))],n=Math.max(multiPK?4:5,sizes.length),extra=n-(multiPK?4:5),pkStart=medical?15:16,pkEnd=medical?(multiPK?24:35):129,last=multiPK?16+2*n:13+n;
 const pk:NativeShippingSheet={name:'PK',patches:[],formulas:[],insertColumns:extra?[{at:multiPK?20:12,count:extra},...(multiPK?[{at:11,count:extra}]:[])]:[],body:{start:pkStart,end:pkEnd,columns:last,rows:[]}};
 const pAdd=(source:number,values:Scalar[])=>{const r=pkStart+pk.body!.rows.length;pk.body!.rows.push({source,values});return r;};
 const header=blank(last);header[0]=`P/I NO. ${s.scNumber}, ORDER NUMBER ${s.poNumber}`;pAdd(pkStart,header);
 const totals:{row:number;line:ShipmentLine}[]=[];
 for(const l of lines){const dataRows:number[]=[];
  for(const b of l.packingRows||[]){const pack=cartonPack(s,l,b.from,b.to);if(falis&&pack.multiple)throw Error('Falis 混碼出貨尚缺對應混碼原表，請先核對格式，未套用單碼版型。');const v=blank(last);Object.assign(v,{0:b.from,1:'~',2:b.to,3:cartonCount(b),4:l.itemNo,5:l.color});
   sizes.forEach((size,i)=>v[6+i]=medical&&pack.multiple?(b.sizes[size]||0)/pack.packs:b.sizes[size]||0);
   if(multiPK){v[7+n]=pack.multiple?pack.packs:null;sizes.forEach((size,i)=>v[11+n+i]=(b.sizes[size]||0)*cartonCount(b));v[11+2*n]=b.netWeight;v[13+2*n]=b.grossWeight;v[15+2*n]=b.measurement;}
   else{v[8+n]=b.netWeight;v[10+n]=b.grossWeight;v[12+n]=b.measurement;}
   const r=pAdd(medical?16:17,v);dataRows.push(r);pk.formulas.push([`D${r}`,`=C${r}-A${r}+1`]);
   if(multiPK){pk.formulas.push([`${col(6+n)}${r}`,`=SUM(G${r}:${col(5+n)}${r})`],[`${col(8+n)}${r}`,pack.multiple?`=${col(7+n)}${r}*D${r}`:'=0'],[`${col(9+n)}${r}`,pack.multiple?`=${col(6+n)}${r}*${col(7+n)}${r}`:`=SUM(G${r}:${col(5+n)}${r})`],[`${col(10+n)}${r}`,`=${col(9+n)}${r}*D${r}`],[`${col(12+2*n)}${r}`,`=${col(11+2*n)}${r}*D${r}`],[`${col(14+2*n)}${r}`,`=${col(13+2*n)}${r}*D${r}`]);}
   else pk.formulas.push([`${col(6+n)}${r}`,`=SUM(G${r}:${col(5+n)}${r})`],[`${col(7+n)}${r}`,`=${col(6+n)}${r}*D${r}`],[`${col(9+n)}${r}`,`=${col(8+n)}${r}*D${r}`],[`${col(11+n)}${r}`,`=${col(10+n)}${r}*D${r}`]);
  }
  const subtotal=blank(last);subtotal[5]='TOTAL';subtotal[last-1]=l.cbm;const r=pAdd(medical?(multiPK?17:22):23,subtotal);totals.push({row:r,line:l});for(const c of multiPK?[3,8+n,10+n,12+2*n,14+2*n]:[3,7+n,9+n,11+n])pk.formulas.push([`${col(c)}${r}`,'='+dataRows.map(r=>`${col(c)}${r}`).join('+')]);
 }
 const grand=blank(last);grand[0]='TOTAL';grand[last-1]=sum(lines,'cbm');const totalPk=pAdd(medical?(multiPK?21:32):127,grand) ;for(const c of multiPK?[3,8+n,10+n,12+2*n,14+2*n]:[3,7+n,9+n,11+n])pk.formulas.push([`${col(c)}${totalPk}`,'='+totals.map(t=>`${col(c)}${t.row}`).join('+')]);pAdd(medical?(multiPK?22:33):128,[`TOTAL ${sum(lines,'cartons')} CARTONS / G.W. ${sum(lines,'grossWeight').toFixed(2)} KGS`]);pAdd(pkEnd,[]);
 const pkDelta=pk.body!.rows.length-(pkEnd-pkStart+1),vesselCol=multiPK?col(14+extra):col(11+extra);
 pk.patches.push(['A1',null],['A2',null],['A3',null],[medical?'D1':'E1',shippingCompany.name],[medical?'E2':'F2',shippingCompany.address],[medical?'E3':'F3',shippingCompany.contact],['A7','INVOICE NO. : '+s.invoiceNo],[`${vesselCol}7`,'VESSEL: '+s.vessel],['A8','P/I NO. '+s.scNumber],[`${vesselCol}8`,'SAILING ON/ABOUT: '+(f.etd||s.date)],['A9',medical?'MESSRS. : '+s.customer:'MESSRS. :'],...(!medical?[["D9",s.customer] as Patch]:[]),[`${vesselCol}9`,`SHIPMENT: FROM ${s.fromPort} TO ${s.toPort}`],[medical?'C10':'D10',s.address.split('\n')[0]||''],[medical?'C11':'D11',s.address.split('\n').slice(1).join('\n')],[`A${(medical?(multiPK?26:37):135)+pkDelta}`,f.shippingMarks||s.customer]);
 if(!medical)pk.patches.push([`A${130+pkDelta}`,'L/C NO. '+(f.lcNumber||'')],[`A${131+pkDelta}`,'ISSUE DATE: '+(f.lcIssueDate||'')],[`A${132+pkDelta}`,'ISSUE BANK: '+(f.lcIssueBank||'')]);
 for(let i=0;i<n;i++){pk.patches.push([`${col(6+i)}${medical?14:15}`,sizes[i]||'']);if(multiPK)pk.patches.push([`${col(11+n+i)}14`,sizes[i]||'']);}
 if(!medical)for(let i=0;i<n;i++)pk.patches.push([`${col(6+i)}14`,null]);
 const weightEnd=medical?25:78,weight:NativeShippingSheet={name:'WEIGHT LIST',patches:[['A1',shippingCompany.name],['A2',shippingCompany.address],['A3',shippingCompany.contact],['B7',s.customer],['B8',`${s.invoiceNo} DATE: ${f.invoiceDate||s.date}`],['B9',f.lcNumber||'T/T'],['A10','ORDER No#'],['B10',s.poNumber]],formulas:[],body:{start:12,end:weightEnd,columns:7,rows:[]}},wr=weight.body!.rows;
 const weightSub:number[]=[];for(const sku of [...new Set(lines.map(l=>l.itemNo))]){wr.push({source:12,values:['ITEM CODE',sku,sku,sku,sku,sku,sku]},{source:13,values:['COLOUR','TOTAL CTNS','TOTAL QTY','TOTAL NET WEIGHT KGS','TOTAL GROSS WEIGHT KGS','TOTAL CBM','CONTAINER NR.']});const begin=12+wr.length;for(const l of lines.filter(l=>l.itemNo===sku))wr.push({source:14,values:[l.color,l.cartons,shipmentQuantity(l),l.netWeight,l.grossWeight,l.cbm,s.container]});const r=12+wr.length;wr.push({source:15,values:['TOTAL']});weightSub.push(r);for(let c=1;c<6;c++)weight.formulas.push([col(c)+r,`=SUM(${col(c)}${begin}:${col(c)}${r-1})`]);wr.push({source:16,values:[]});}
 const grandW=12+wr.length;wr.push({source:medical?22:75,values:['TOTAL']});for(let c=1;c<6;c++)weight.formulas.push([col(c)+grandW,'='+weightSub.map(r=>col(c)+r).join('+')]);wr.push({source:weightEnd,values:[]});weight.patches.push([`A${(medical?27:80)+wr.length-(weightEnd-12+1)}`,f.shippingMarks||s.customer]);
 return {template:falis?'falis':(premium?'premium':'medico')+(singleMedical?'-single':''),sheets:[invoice,pk,weight]};
}
export function containerBookingRecipe(shipments:Shipment[],orders:OrderData[],kind:'booking'|'ocean'):NativeShippingRecipe{
 const recipes=shipments.map(s=>{const o=orders.find(o=>o.poNumber===s.poNumber&&o.piNumber===s.scNumber);if(!o)throw Error(`缺少 ${s.poNumber} 原始訂單。`);return bookingRecipe(s,o,kind);});
 if(!recipes.length)throw Error('本櫃尚未加入訂單。');
 const first=shipments[0];
 if(shipments.some(s=>['customer','address','vessel','container','fromPort','toPort'].some(k=>s[k as keyof Shipment]!==first[k as keyof Shipment])||['etd','containerType'].some(k=>s.factoryNotice?.[k]!==first.factoryNotice?.[k])))throw Error('同櫃訂艙的收貨人、地址、船名、港口、櫃號、櫃型及 ETD 須一致；請先核對各 PO。');
 if(recipes.some(r=>r.template!==recipes[0].template))throw Error('同櫃訂艙不可混用不同出口港格式。');
 const recipe=recipes[0],sheet=recipe.sheets[0],pos=shipments.map(s=>s.poNumber).join(' / '),scs=shipments.map(s=>s.scNumber).join(' / '),invoices=shipments.map(s=>s.invoiceNo).join(' / '),lcs=[...new Set(shipments.map(s=>s.factoryNotice?.lcNumber||'').filter(Boolean))].join(' / ');
 const patch=(cell:string,value:Scalar)=>{sheet.patches=sheet.patches.filter(p=>p[0]!==cell);sheet.patches.push([cell,value]);};
 if(kind==='booking'){
  const rows=recipes.flatMap((r,i)=>r.sheets[0].body!.rows.map(row=>{const values=[...row.values];values[0]=shipments[i].poNumber+' / '+values[0];return {...row,values};}));
  sheet.body!.rows=rows;sheet.formulas=[];const total=40+rows.length;patch('A20','L/C NR. '+lcs);patch('A31','PRO FORMA INVOICE NR. '+scs);patch('A32','CUSTOMER ORDER NR. '+pos);
  // Remove each source's total patch before writing the one container total.
  sheet.patches=sheet.patches.filter(([cell,value])=>!(value==='TOTAL'&&/^A\d+$/.test(cell)));patch('A'+total,'TOTAL');for(const c of ['G','H','I','J'])sheet.formulas.push([c+total,`=SUM(${c}40:${c}${total-1})`]);
 }else{
  const estimates=shipments.flatMap(shipmentEstimates),sum=(key:'quantity'|'cartons'|'grossWeight'|'cbm')=>estimates.reduce((n,e)=>n+e[key],0);
  patch('H2',invoices);patch('H22',pos);patch('M22',lcs);patch('E34',sum('cartons'));patch('M34',sum('grossWeight'));patch('O34',sum('cbm'));patch('F35',`ORDER NO. ${pos} AS PER P/I ${scs}\nTOTAL ${sum('quantity')} PCS\nINVOICE ${invoices}\nL/C ${lcs}\n${first.factoryNotice?.containerType||''}`);
 }
 return recipe;
}
export function bookingRecipe(s:Shipment,o:OrderData,kind:'booking'|'ocean'):NativeShippingRecipe{
 const f=s.factoryNotice||{},port=/SHANGHAI|上海/i.test(s.fromPort)?'shanghai':/XIAMEN|廈門|厦门/i.test(s.fromPort)?'xiamen':'';if(!port)throw Error('請先確認出口港為上海或廈門，才能選用對應訂艙原表。');if(f.bookingConfirmed!=='Y')throw Error('請先勾選已與客人確認櫃型、出口港及出貨安排。');
 const estimates=shipmentEstimates(s);if(!estimates.some(e=>e.quantity>0)||estimates.some(e=>e.quantity>0&&!(e.cartons>0&&e.grossWeight>0&&e.cbm>0)))throw Error('請先保存有效的工廠預估件數、箱數、毛重與材積。');const metrics=(key:'quantity'|'cartons'|'grossWeight'|'cbm')=>estimates.reduce((n,e)=>n+e[key],0);
 const consignee=(f.consignee||('TO THE ORDER OF '+s.customer+'\n'+s.address)).split('\n'),notify=(f.notify||(s.customer+'\n'+s.address)).split('\n');
 if(kind==='ocean')return {template:`ocean-${port}`,sheets:[{name:'Sheet1',patches:[['C2',shippingCompany.name],['C3','7 F., NO. 522, SEC. 5, ZHONGSHAN N. RD.'],['C4','SHILIN DIST., TAIPEI CITY 111005 TAIWAN'],['C5',shippingCompany.contact],['H2',s.invoiceNo],['H11',f.invoiceDate||''],['C11',consignee[0]||''],['C12',consignee[1]||''],['C13',consignee.slice(2).join('\n')],['C19',notify[0]||''],['C20',notify[1]||''],['C21',notify[2]||''],['C22',notify.slice(3).join('\n')],['H22',s.poNumber],['M22',f.lcNumber||''],['H24',s.vessel],['M24',s.fromPort],['H27',f.etd||''],['M27',f.destinationCountry||'ITALY'],['C30',s.toPort],['E34',metrics('cartons')],['M34',metrics('grossWeight')],['O34',metrics('cbm')],['C35',f.shippingMarks||s.customer],['F35',`ORDER NO. ${s.poNumber} AS PER P/I ${s.scNumber}\nTOTAL ${metrics('quantity')} PCS\nINVOICE ${s.invoiceNo}\nL/C ${f.lcNumber||''}\n${f.containerType||''}`]],formulas:[]}]};
 const sheet:NativeShippingSheet={name:'Foglio1',patches:[['A16',shippingCompany.name],['A17','7 F., NO. 522, SEC. 5, ZHONGSHAN N. RD.'],['A18','SHILIN DIST., TAIPEI CITY 111005 TAIWAN'],['A19',shippingCompany.contact],['A20','L/C NR. '+(f.lcNumber||'')],['A22',`BENEFICIARY OF L/C: ${shippingCompany.name}\n${shippingCompany.address}`],['A31','PRO FORMA INVOICE NR. '+s.scNumber],['A28',consignee.join('\n')],['E28',notify[0]||''],['E29',notify[1]||''],['E30',notify.slice(2).join('\n')],['A32','CUSTOMER ORDER NR. '+s.poNumber],['E33',f.deliveryToForwarder||''],['E35',f.etd||''],['A37','PORT OF DEPARTURE: '+s.fromPort]],formulas:[],body:{start:40,end:51,columns:14,rows:[]}};
 for(const e of estimates.filter(e=>e.quantity>0)){const l=s.lines.find(l=>l.id===e.lineId)!;const v=blank(14);Object.assign(v,{0:l.itemNo,2:invoiceLineText(s,o,l).description,5:l.color,6:e.quantity,7:e.cartons,8:e.grossWeight,9:e.cbm,10:s.factoryNotice?.['hsCode:'+l.itemNo]||''});sheet.body!.rows.push({source:40,values:v});}
 const total=40+sheet.body!.rows.length;sheet.patches.push([`A${total}`,'TOTAL']);for(const c of ['G','H','I','J'])sheet.formulas.push([c+total,`=SUM(${c}40:${c}${total-1})`]);return {template:`booking-${port}`,sheets:[sheet]};
}
export function shipmentTrackingRecipe(rows:TrackingRecord[],w:Workspace,orders:OrderData[],date:string):NativeShippingRecipe{
 const data=shipmentTrackingData(rows,w,orders);
 if(!data.length)throw Error('目前沒有可匯出的待出貨訂單。');
 const seen=new Set<string>(),sheet:NativeShippingSheet={name:'CSQ',patches:[['A1',shippingCompany.name],['J4',date]],formulas:[],body:{start:8,end:324,columns:16,rows:[]}};
 for(const [i,d]of data.entries()){const values=[...d.values];if(seen.has(d.metricsKey))for(const c of [9,10,11])values[c]='';else if(Number(values[9])>0&&Number(values[11])>0)sheet.formulas.push([`L${i+8}`,`=J${i+8}*${Number(values[11])/Number(values[9])}`]);seen.add(d.metricsKey);sheet.body!.rows.push({source:8,values});}
 const total=8+data.length;sheet.body!.rows.push({source:12,values:['TOTAL']});for(const c of ['E','J','K','L'])sheet.formulas.push([c+total,`=SUM(${c}8:${c}${total-1})`]);
 return {template:'shipment-tracking',sheets:[sheet,{name:'工作表1',patches:[],formulas:[],body:{start:2,end:108,columns:17,rows:[]}}]};
}
export async function loadNativeShipping(recipe:NativeShippingRecipe){const health=await fetch('/api/local-health',{cache:'no-store'});if(!health.ok||(await health.json()).app!=='order-converter-local')throw Error('請從本機工作站開啟，使用 Excel 產生客戶指定原表。');const response=await fetch('/api/local-shipping-workbook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(recipe)});if(!response.ok){const p=await response.json().catch(()=>({}));throw Error(p.error||'原表產生失敗。');}return response.arrayBuffer();}
export async function exportNativeShipping(recipe:NativeShippingRecipe,filename:string){const bytes=await loadNativeShipping(recipe),url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();return {url,filename};}
