import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import type {OrderData} from '../types/order';
import type {ErpSnapshot} from './erpProducts';
import {factoryDirectory} from './factoryDirectory';
import {shipmentQuantity,type Shipment,type ShipmentLine} from './workspace';
import {cartonPack} from './shippingNativeRecipes';
import {withCartons,type CartonRow} from './shipmentPacking';
import {shipmentSelectionIssues} from './shipmentSelection';
import {newId} from './uid';
import {shippingCompany} from './shippingWorkflow';
export interface FactoryPackingGroup {code:string;name:string;shipments:Shipment[]}
export function factoryPackingGroups(shipments:Shipment[],erp:ErpSnapshot|null){
 const directory=factoryDirectory(erp),groups=new Map<string,FactoryPackingGroup>();
 for(const s of shipments)for(const line of s.lines){if(!line.supplier.trim())throw Error(`${s.poNumber} / ${line.itemNo} 尚未指定工廠。`);const factory=directory.resolve(line.supplier),code=factory?.code||line.supplier,name=factory?.name||line.supplier;let g=groups.get(code);if(!g){g={code,name,shipments:[]};groups.set(code,g);}let part=g.shipments.find(x=>x.id===s.id);if(!part){part={...s,lines:[]};g.shipments.push(part);}part.lines.push(line);}
 return [...groups.values()];
}
const col=(n:number)=>XLSX.utils.encode_col(n-1);
interface PackingMap {sheet:string;first:number;last:number;shipmentId:string;po:string;sc:string;lineId:string;sku:string;color:string;mode:'single'|'multiple';sizes:string[];n:number}
export function factoryPackingWorkbook(g:FactoryPackingGroup,orders:OrderData[],kind:'estimate'|'actual'){
 const wb=new ExcelJS.Workbook();wb.creator=shippingCompany.name;wb.calcProperties.fullCalcOnLoad=true;
 const maps:PackingMap[]=[];
 const sections=g.shipments.flatMap(s=>{const families=new Map<string,ShipmentLine[]>();for(const l of s.lines){const key=Object.keys(l.sizes).sort().join('|');families.set(key,[...(families.get(key)||[]),l]);}return [...families.values()].map(lines=>({...s,lines}));});
 for(const [idx,s] of sections.entries()){
  const o=orders.find(o=>o.poNumber===s.poNumber&&o.piNumber===s.scNumber);if(!o)throw Error(`缺少 ${s.poNumber} 原始 PO。`);
  const multi=o.packingType==='MULTIPLE PACK',sizes=[...new Set(s.lines.flatMap(l=>Object.keys(l.sizes)))],n=Math.max(6,sizes.length),last=multi?20+2*n:17+n,ws=wb.addWorksheet(`${idx+1}-${s.poNumber}`.slice(0,31),{views:[{state:'frozen',ySplit:7}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
  ws.columns=Array.from({length:last},(_,i)=>({width:i===4?24:i===5?20:i===6?25:i<4?7:8}));
  const title=(r:number,text:string)=>{ws.mergeCells(r,1,r,last);ws.getCell(r,1).value=text;ws.getRow(r).height=r===1?27:22;ws.getRow(r).font={name:'Aptos',size:r===1?16:10,bold:r===1};};
  title(1,shippingCompany.name);title(2,`${g.name} · ${kind==='estimate'?'預估清單':'實際出貨清單'} · ${multi?'MULTIPLE PACK':'SINGLE PACK'}`);title(3,`P/I: ${s.scNumber}    PO: ${s.poNumber}    Invoice: ${s.invoiceNo}`);title(4,`船名: ${s.vessel}    櫃號: ${s.container}    FROM ${s.fromPort} TO ${s.toPort}    L/C: ${s.factoryNotice?.lcNumber||''}`);title(5,'淡黃色為工廠回填；白色計算欄保留公式。尺碼為每箱件數（單碼）／每包配比（混碼）。可用下一空白列拆箱。');title(6,'數量以本次選取為上限；預估與實際使用相同欄位，匯入時按 PO / 款式 / 顏色 / 尺碼核對。');
  let r=8;const totals:number[]=[];
  for(const l of s.lines){
   const item=o.items.find(i=>l.id.startsWith(i.id+':'))||o.items.find(i=>i.itemNo===l.itemNo),c=item?.colors.find(c=>`${c.colorCode} ${c.colorName}`.trim()===l.color.trim());
   title(r++,`${l.itemNo}   ${l.color}   本次選取 ${l.planned} ${l.unit}`);
   const headers=['箱號起','～','箱號迄','箱數','品名','款號','色號 / 色名',...Array.from({length:n},(_,i)=>sizes[i]||'')];
   if(multi)headers.push('每包件數','每箱包數','總包數','每箱件數','總件數',...Array.from({length:n},(_,i)=>sizes[i]?sizes[i]+' 總件數':''),'每箱淨重','總淨重','每箱毛重','總毛重','長 cm','寬 cm','高 cm','材積 m³');
   else headers.push('每箱件數','總件數','每箱淨重','總淨重','每箱毛重','總毛重','長 cm','寬 cm','高 cm','材積 m³');
   ws.getRow(r).values=headers;ws.getRow(r).height=40;ws.getRow(r).eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFD7E9EA'}};cell.font={bold:true,name:'Aptos',size:10};cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};});r++;
   const estimated:Record<string,CartonRow[]>=JSON.parse(s.factoryNotice?.estimatePackingRows||'{}'),usingEstimate=!l.packingRows?.length&&!!estimated[l.id]?.length,boxes=l.packingRows?.length?l.packingRows:estimated[l.id]||[],effective=usingEstimate?{...s,factoryNotice:{...s.factoryNotice,standardPacking:s.factoryNotice?.estimateStandardPacking||'{}'}}:s,first=r,count=Math.max(5,boxes.length+3);
   for(let i=0;i<count;i++,r++){
    const b=boxes[i],pack=b?cartonPack(effective,l,b.from,b.to):{multiple:multi,packs:0},values:unknown[]=[b?.from??null,'~',null,b?b.to-b.from+1:null,(item?.styleName||l.itemNo).split(/\s*-?\s*Products composition|\bBODY\s*:|\bLIN[NI]*NG\s*:/i)[0].trim(),l.itemNo,l.color];
    for(let j=0;j<n;j++)values.push(b?(multi?(b.sizes[sizes[j]]||0)/(pack.packs||1):b.sizes[sizes[j]]||0):multi?(c?.ratioBySize?.[sizes[j]]??item?.orderMultipleBySize?.[sizes[j]]??null):null);
    const quantity=b?Object.values(b.sizes).reduce((a,b)=>a+b,0):0,ctns=b?b.to-b.from+1:0,dimensions=b?.measurement.match(/[\d.]+/g)?.slice(0,3).map(Number)||[];
    const totalCol=multi?12+n:9+n,nw=multi?13+2*n:10+n,gw=nw+2,dim=nw+4,cbm=dim+3;
    ws.getRow(r).values=values as ExcelJS.CellValue[];const set=(c:number,v:ExcelJS.CellValue)=>ws.getCell(r,c).value=v;
    const formula=(c:number,f:string,result:number)=>set(c,{formula:f,result});const ready=`AND(ISNUMBER(A${r}),ISNUMBER(D${r}),D${r}>0)`;
    formula(3,`IF(${ready},A${r}+D${r}-1,0)`,b?.to||0);
    if(multi){const per=8+n,packs=9+n,totalPacks=10+n,perBox=11+n;set(packs,pack.packs||null);formula(per,`SUM(H${r}:${col(7+n)}${r})`,multi&&pack.packs?quantity/pack.packs:0);formula(totalPacks,`${col(packs)}${r}*D${r}`,pack.packs*ctns);formula(perBox,`${col(per)}${r}*${col(packs)}${r}`,quantity);formula(totalCol,`${col(perBox)}${r}*D${r}`,quantity*ctns);for(let j=0;j<n;j++)formula(13+n+j,`${col(8+j)}${r}*${col(totalPacks)}${r}`,(b?.sizes[sizes[j]]||0)*ctns);}
    else{formula(8+n,`SUM(H${r}:${col(7+n)}${r})`,quantity);formula(totalCol,`${col(8+n)}${r}*D${r}`,quantity*ctns);}
    set(nw,b?.netWeight||null);set(gw,b?.grossWeight||null);dimensions.forEach((v,i)=>set(dim+i,v));formula(nw+1,`${col(nw)}${r}*D${r}`,(b?.netWeight||0)*ctns);formula(gw+1,`${col(gw)}${r}*D${r}`,(b?.grossWeight||0)*ctns);formula(cbm,`D${r}*${col(dim)}${r}*${col(dim+1)}${r}*${col(dim+2)}${r}/1000000`,(b?.cbm||0)*ctns);
    const input=[1,4,...Array.from({length:sizes.length},(_,j)=>8+j),...(multi?[9+n]:[]),nw,gw,dim,dim+1,dim+2];
    for(let ci=1;ci<=last;ci++){const cell=ws.getCell(r,ci);cell.font={name:'Aptos',size:10};cell.border={bottom:{style:'hair',color:{argb:'FFCAD6D6'}}};cell.alignment={vertical:'middle',wrapText:ci===5||ci===7};if(cell.type===ExcelJS.ValueType.Formula)cell.numFmt=ci===nw+1||ci===gw+1||ci===cbm?'0.00;-0.00;;@':'0;-0;;@';if(input.includes(ci)){cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF2CC'}};cell.numFmt=ci===nw||ci===gw||ci>=dim?'0.00':'0';cell.dataValidation={type:ci===nw||ci===gw||ci>=dim?'decimal':'whole',operator:'greaterThanOrEqual',formulae:[0],allowBlank:true,showErrorMessage:true,error:'請填非負數字'};}}
    ws.getRow(r).height=30;
   }
   maps.push({sheet:ws.name,first,last:r-1,shipmentId:s.id,po:s.poNumber,sc:s.scNumber,lineId:l.id,sku:l.itemNo,color:l.color,mode:multi?'multiple':'single',sizes,n});
   ws.getCell(r,5).value='TOTAL';const indices=multi?[4,10+n,12+n,14+2*n,16+2*n,20+2*n]:[4,9+n,11+n,13+n,17+n];
   for(const ci of indices){let result=0;for(let ri=first;ri<r;ri++){const v=ws.getCell(ri,ci).value;result+=typeof v==='number'?v:typeof v==='object'&&v&&'result' in v?Number(v.result)||0:0;}ws.getCell(r,ci).value={formula:`SUM(${col(ci)}${first}:${col(ci)}${r-1})`,result};}totals.push(r);ws.getRow(r).font={bold:true,name:'Aptos',size:10};r+=2;
  }
  ws.pageSetup.printArea=`A1:${col(last)}${r}`;ws.pageSetup.printTitlesRow='1:6';
 }
 const meta=wb.addWorksheet('_CSQ',{state:'veryHidden'});meta.getCell('A1').value='CSQ_FACTORY_PACKING_V1';meta.getCell('B1').value=g.code;maps.forEach((m,i)=>meta.getCell(i+2,1).value=JSON.stringify(m));
 return wb;
}
export function parseFactoryPackingWorkbook(book:XLSX.WorkBook,members:Shipment[],kind:'estimate'|'actual'):Shipment[]{
 const meta=book.Sheets._CSQ;if(meta?.A1?.v!=='CSQ_FACTORY_PACKING_V1')throw Error('請使用新版同工廠預估／實際共用清單。');
 const raw=XLSX.utils.sheet_to_json<unknown[]>(meta,{header:1,defval:''}),maps=raw.slice(1).filter(r=>r[0]).map(r=>JSON.parse(String(r[0])) as PackingMap);
 if(!maps.length||maps.length>3000)throw Error('清單對應資料不完整。');
 const result=new Map<string,Shipment>();let filled=0;const seen=new Set<string>();
 for(const m of maps){
  if(!Number.isInteger(m.first)||!Number.isInteger(m.last)||m.first<1||m.last<m.first||m.last>20000||!['single','multiple'].includes(m.mode)||!Array.isArray(m.sizes)||!Number.isInteger(m.n)||m.n<6||m.n>40||m.sizes.length>m.n)throw Error('清單欄位對應不符。');
  const s=members.find(s=>s.id===m.shipmentId&&s.poNumber===m.po&&s.scNumber===m.sc);if(!s||s.confirmed)throw Error(`${m.po} 不在本櫃可編輯的出貨訂單。`);
  const l=s.lines.find(l=>l.id===m.lineId&&l.itemNo===m.sku&&l.color===m.color);if(l&&m.sizes.some(size=>!(size in l.sizes)))throw Error('尺碼對應已變更。');if(!l)throw Error(`${m.po} 款色已變更，請重新產生清單。`);
  if(seen.has(s.id+':'+l.id))throw Error('清單款色區塊重複。');seen.add(s.id+':'+l.id);
  const ws=book.Sheets[m.sheet];if(!ws)throw Error('清單缺少工作表。');const get=(r:number,c:number)=>ws[XLSX.utils.encode_cell({r:r-1,c:c-1})]?.v??'';
  if(!String(get(3,1)).includes(m.sc)||!String(get(3,1)).includes(m.po))throw Error('工作表 PO / S/C 與對應資料不同。');
  const boxes:CartonRow[]=[],standard:Record<string,{mode:string;packs:number}>={};
  for(let r=m.first;r<=m.last;r++){
   const n=m.n,multi=m.mode==='multiple',nw=multi?13+2*n:10+n,gw=nw+2,dim=nw+4;
   const inputs=[get(r,1),get(r,4),...Array.from({length:n},(_,i)=>get(r,8+i)),...(multi?[get(r,9+n)]:[]),get(r,nw),get(r,gw),get(r,dim),get(r,dim+1),get(r,dim+2)];
   if(!inputs.some(v=>v!==''&&v!==0))continue;
   // Prefilled MULTIPLE ratios alone are not a filled carton.
   if(![get(r,1),get(r,4),...(multi?[get(r,9+n)]:[]),get(r,nw),get(r,gw),get(r,dim),get(r,dim+1),get(r,dim+2)].some(v=>v!==''&&v!==0)&&multi)continue;
   if(String(get(r,6))!==l.itemNo||String(get(r,7))!==l.color)throw Error(`第 ${r} 列：款號／顏色已變更。`);
   const from=Number(get(r,1)),count=Number(get(r,4)),packs=multi?Number(get(r,9+n)):1,net=Number(get(r,nw)),gross=Number(get(r,gw)),dims=[dim,dim+1,dim+2].map(c=>Number(get(r,c)));
   if(Array.from({length:n-m.sizes.length},(_,i)=>Number(get(r,8+m.sizes.length+i)||0)).some(v=>v!==0))throw Error('請勿在未標示尺碼的欄位填入數量。');
   const q=Object.fromEntries(m.sizes.map((size,i)=>[size,Number(get(r,8+i)||0)*packs]));
   if(!Number.isInteger(from)||from<1||!Number.isInteger(count)||count<1||!Number.isInteger(packs)||packs<1||Object.values(q).some(v=>!Number.isInteger(v)||v<0)||!Object.values(q).some(v=>v>0)||!Number.isFinite(net)||net<0||kind==='actual'&&net<=0||!Number.isFinite(gross)||gross<=0||gross<net||dims.some(v=>!Number.isFinite(v)||v<=0))throw Error(`${m.po} 第 ${r} 列：請填有效箱號、箱數、尺碼／包數、重量及外箱尺寸。`);
   const to=from+count-1;boxes.push({id:newId(),from,to,sizes:q,netWeight:net,grossWeight:gross,cbm:dims.reduce((a,b)=>a*b,1)/1000000,measurement:dims.join('X')+'CM'});standard[JSON.stringify([l.id,from,to])]={mode:multi?'MULTIPLE PACK':'NORMAL PACK',packs};filled++;
  }
  const next=result.get(s.id)||{...s,lines:[...s.lines],factoryNotice:{...s.factoryNotice,importedPackingLineIds:'[]'}},updated=withCartons(l,boxes);next.factoryNotice={...next.factoryNotice,importedPackingLineIds:JSON.stringify([...JSON.parse(next.factoryNotice?.importedPackingLineIds||'[]'),l.id])};next.lines=next.lines.map(x=>x.id===l.id?updated:x);next.factoryNotice={...next.factoryNotice,standardPacking:JSON.stringify({...JSON.parse(next.factoryNotice?.standardPacking||'{}'),...standard})};result.set(s.id,next);
 }
 if(!filled)throw Error('沒有已回填的裝箱資料。');
 for(const s of result.values()){const issues=shipmentSelectionIssues(s);if(issues.length)throw Error(issues.join('；'));const ranges:CartonRow[]=[];for(const l of s.lines)for(const r of l.packingRows||[]){if(ranges.some(x=>r.from<=x.to&&r.to>=x.from))throw Error(`${s.poNumber} 箱號重複。`);ranges.push(r);}}
 return [...result.values()];
}
export async function readFactoryGroupPacking(file:File,members:Shipment[],kind:'estimate'|'actual'){return parseFactoryPackingWorkbook(XLSX.read(await file.arrayBuffer(),{type:'array'}),members,kind);}
