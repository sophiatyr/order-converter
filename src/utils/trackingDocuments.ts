import ExcelJS from 'exceljs';
import type {OrderData} from '../types/order';
import type {TrackingRecord,Shipment} from './workspace';
import {bulkPhases,bulkOrderLabels,internalLabels,columnKey,overallCheck} from './trackingFields';
import {daysToFactory} from './trackingAutomation';
import {poStyleItems,shipmentStyleQuantity} from './trackingPoSource';
import type {OrderItem} from '../types/order';

export function poColorItemNumber(item:OrderItem,colorCode:string){
 const vendor=(item.vendorPart||'').trim(),code=colorCode.trim(),base=item.erpItemNo===item.itemNo?item.itemNo.replace(/-(XS|S|M|L|XL|XXL|XXXL)$/,''):item.itemNo,compact=(value:string)=>value.toUpperCase().replace(/[\s\-_/]/g,'');
 // Keep the literal vendor item number (including its separator) when it
 // belongs to this colour. Merged styles may retain only the first colour's vendorPart.
 if(vendor&&code&&compact(vendor)===compact(base)+compact(code))return vendor;
 return [base,code].filter(Boolean).join('-');
}

export function completeCustomerRows(rows:TrackingRecord[],orders:OrderData[]=[],overrides:Record<string,Partial<TrackingRecord>>={},shipments?:Shipment[]){
 return rows.flatMap(r=>{
  const source=orders.find(o=>o.poNumber===r.poNumber&&o.piNumber===r.scNumber),items=poStyleItems(source,r.itemNo);
  const quantity=items.reduce((n,i)=>n+i.colors.reduce((n,c)=>n+c.totalQuantity,0),0);
  if(items.length&&quantity===r.quantity)return customerRows([r],orders,overrides,shipments);
  const pending=customerRows([r],[],overrides,shipments)[0];
  return [{...pending,color:'TO BE CONFIRMED',sourceIssue:items.length?'PO QUANTITY RECONCILIATION PENDING':'COLOUR BREAKDOWN TO BE CONFIRMED',description:[pending.description,items.length?'PO QUANTITY RECONCILIATION PENDING':'COLOUR BREAKDOWN TO BE CONFIRMED'].filter(Boolean).join(' / ')}];
 });
}

export function customerRows(rows:TrackingRecord[],orders:OrderData[]=[],overrides:Record<string,Partial<TrackingRecord>>={},shipments?:Shipment[]){
 return rows.flatMap(r=>{
  const items=poStyleItems(orders.find(o=>o.poNumber===r.poNumber&&o.piNumber===r.scNumber),r.itemNo);
  if(r.color!==undefined)return [r];
  const expanded=items.length?items.flatMap(i=>i.colors.map(c=>({...r,id:`${r.id}:colour:${i.id}:${c.id}`,quantity:c.totalQuantity,color:`${c.colorCode} ${c.colorName}`,description:i.styleName,customerItem:poColorItemNumber(i,c.colorCode),supplier:i.factoryProduct?.supplier||r.supplier}))):[{...r,color:'',description:'',customerItem:''}];
  const legacy:Record<string,string>={};for(const key of ['tp','labDip','fitSample','pps','cutting','sewing','shippingSample','inspection','packing'] as const){if(/^\d{4}-\d{2}-\d{2}$/.test(r[key]))legacy[key+'Date']=r[key];}if(/^\d{4}-\d{2}-\d{2}$/.test(r.fabricTestDate))legacy.fabricTestDate=r.fabricTestDate;if(r.fabricTestStatus==='PASS')legacy.fabricTestStatus='APPROVED';
  return expanded.map(x=>{const result:TrackingRecord & {bulk:Record<string,string>}={...x,...overrides[x.id],bulk:{...legacy,...r.bulk,...overrides[x.id]?.bulk,...(r.shippedQuantity!==undefined?{shipmentStatus:r.bulk?.shipmentStatus||'PLANNED',shipmentDate:r.bulk?.shipmentDate||r.bulk?.shipmentPlannedDate||''}:{})}};
    if(shipments&&items.length){const source=orders.find(o=>o.poNumber===r.poNumber&&o.piNumber===r.scNumber),shipped=shipments.filter(s=>s.confirmed&&s.poNumber===r.poNumber&&s.scNumber===r.scNumber);const matches=shipped.flatMap(s=>s.lines.filter(l=>l.color===x.color).map(l=>({date:s.date,qty:shipmentStyleQuantity(l,r.itemNo,source)}))).filter(l=>l.qty>0);const qty=matches.reduce((n,l)=>n+l.qty,0);result.shippedQuantity=qty;result.status=qty>=x.quantity&&qty>0?'已出貨':qty>0?'部分出貨':'尚未出貨';result.bulk.shipmentStatus=result.status==='已出貨'?'SHIPPED':'PLANNED';result.bulk.shipmentDate=result.status==='已出貨'?matches.map(l=>l.date).sort().at(-1)||'':result.bulk.shipmentPlannedDate||'';}
   return result;
  });
 });
}
function dateValue(value:string){
 const t=value.trim(),m=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);const iso=m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:t;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return value;
 const d=new Date(`${iso}T00:00:00Z`);return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===iso?d:value;
}
export function internalValues(r:TrackingRecord){
 const base:Record<string,string>={A:r.scNumber,B:r.poNumber,C:r.season,D:r.brand,E:r.series||r.brand,F:r.company,J:r.supplier,O:r.itemNo,P:String(r.quantity),Q:r.unit,T:r.customerDate,U:r.factoryDate,W:r.tp,AA:r.labDip,AB:r.fitSample,AD:r.pps,AF:r.shippingSample,AH:r.inspection};
 const values={...base,...r.internalFields};const days=daysToFactory(r.factoryDate||values.U||'');values.V=days===null?'':String(days);return values;
}
export function buildInternalTracking(rows:TrackingRecord[]){
 const w=new ExcelJS.Workbook(),s=w.addWorksheet('內部訂單追蹤');s.addRow(['內部使用：包含價格、利潤及收付款資料']);s.mergeCells(1,1,1,46);s.addRow(internalLabels);
 for(const r of rows){const values=internalValues(r);s.addRow(internalLabels.map((_,i)=>{const key=columnKey(i),v=values[key]||'';if(['H','L','M','N','P','V','AP'].includes(key)&&v!==''&&Number.isFinite(Number(v)))return Number(v);return dateValue(v);}));}
 style(s,46,2);s.getColumn(11).width=42;s.getColumn(15).width=26;s.getColumn(41).width=32;
 for(let n=3;n<=s.rowCount;n++){s.getCell(n,14).numFmt='0.00%';for(const c of [8,12,13])s.getCell(n,c).numFmt='#,##0.00';const f=rows[n-3].internalFields||{},currency=f._costCurrency;if(currency==='USD'||currency==='RMB')s.getCell(n,12).numFmt=`"${currency} "#,##0.00`;
  if(f.N!==''&&Number.isFinite(Number(f.N))&&f._saleForMargin&&f.M!==''){const sale=Number(f._saleForMargin);s.getCell(n,14).value={formula:`IF(${sale}>0,(${sale}-M${n})/${sale},"")`,result:Number(f.N)};}
 }
 // Source prices and profits can span several styles. Keep their original group scope.
 for(const col of ['H','L','M','N']){let start=3,last='';rows.forEach((r,i)=>{const group=r.internalFields?.[`_scope${col}`]||r.id;if(group!==last){if(i+2>start)s.mergeCells(`${col}${start}:${col}${i+2}`);start=i+3;last=group;}if(i===rows.length-1&&i+3>start)s.mergeCells(`${col}${start}:${col}${i+3}`);});}
 return w;
}
function style(s:ExcelJS.Worksheet,cols:number,header:number){
 s.views=[{state:'frozen',xSplit:5,ySplit:header,showGridLines:false}];s.autoFilter={from:{row:header,column:1},to:{row:s.rowCount,column:cols}};
 for(let c=1;c<=cols;c++)s.getColumn(c).width=c===3||c===4?23:19;
 s.properties.defaultRowHeight=20;
 s.eachRow({includeEmpty:true},row=>{row.height=20;row.eachCell({includeEmpty:true},cell=>{cell.font={name:'Aptos',size:10};cell.alignment={vertical:'middle',wrapText:true};if(cell.value instanceof Date)cell.numFmt='dd-mmm-yyyy';if(typeof cell.value==='number')cell.numFmt='#,##0';});});
 s.getRow(header).eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF256F63'}};c.font={...c.font,bold:true,color:{argb:'FFFFFFFF'}};});
 s.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:0,fitToHeight:0,printTitlesRow:`${header}:${header}`};
}
export function buildCustomerBulk(rows:TrackingRecord[],orders:OrderData[]=[],week=new Date().toISOString().slice(0,10)){
 const exportRows=completeCustomerRows(rows.filter(r=>r.color===undefined),orders);
 const data=rows.every(r=>r.color!==undefined)?rows:rows.flatMap(r=>r.color!==undefined?[r]:exportRows.filter(x=>x.id===r.id||x.id.startsWith(r.id+':colour:')));
 const w=new ExcelJS.Workbook(),s=w.addWorksheet('CURRENT BULK');s.addRow(['BULK STATUS – SUPPLIER UPDATE']);s.mergeCells('A1:AS1');s.addRow(['REPORTING DATE',dateValue(week)]);s.addRow(['YELLOW = ORDER DATA','BLUE = SUPPLIER INPUT','GREEN = APPROVED / COMPLETED','RED = OVERDUE / ERROR']);
 s.addRow([]);s.addRow(bulkOrderLabels);s.mergeCells('A4:M4');s.getCell('A4').value='ORDER & PRODUCT DATA';
 let col=14;const phaseCols:Record<string,number>={};for(const [key,label,dateLabel] of bulkPhases){if(key==='cutting'){s.getCell(4,col).value='OVERALL CHECK';s.getCell(5,col++).value='RESULT – AUTO';}phaseCols[key]=col;s.getCell(4,col).value=label;s.mergeCells(4,col,4,col+(key==='shippingSample'?2:1));s.getCell(5,col).value=dateLabel;s.getCell(5,col+1).value='STATUS';if(key==='shippingSample')s.getCell(5,col+2).value='CISALFA APPROVAL DATE';col+=key==='shippingSample'?3:2;}

 for(const r of data){
  const b=r.bulk||{},v=r.internalFields||{};const line:(string|number|Date|ExcelJS.CellFormulaValue)[]=[b.supplierName??"SPORTS KITE INTERNATIONAL CO., LTD.",b.brand??r.brand,r.itemNo,b.color??r.color??'',r.poNumber,b.orderCompany??v.G??r.company,dateValue(b.customerDate??r.customerDate),dateValue(b.confirmedDate||''),r.quantity,b.factoryName??v.K??r.supplier,b.contact||'',r.customerItem||b.customerItem||'',b.description??r.description??''];

  for(const [key] of bulkPhases){if(key==='cutting')line.push(overallCheck(b));const omit=false;line.push(omit?'':dateValue(b[key+'Date']||''),omit?'':b[key+'Status']||'');if(key==='shippingSample')line.push(omit?'':dateValue(b.shippingApprovalDate||''));}
  const row=s.addRow(line),n=row.number;
  s.getCell(n,32).value={formula:`IF(AND(O${n}="RECEIVED",OR(Q${n}="APPROVED",Q${n}="NOT REQUIRED"),OR(S${n}="APPROVED",S${n}="NOT REQUIRED"),OR(U${n}="APPROVED",U${n}="NOT REQUIRED"),W${n}="RECEIVED",OR(Y${n}="APPROVED",Y${n}="NOT REQUIRED"),OR(AA${n}="APPROVED",AA${n}="NOT REQUIRED"),OR(AC${n}="APPROVED",AC${n}="NOT REQUIRED"),AE${n}="APPROVED"),"READY","NOT READY")`,result:overallCheck(b)};
  for(const [key,,,statuses] of bulkPhases){const c=phaseCols[key];s.getCell(n,c+1).dataValidation={type:'list',allowBlank:true,formulae:[`"${statuses.join(',')}"`],showErrorMessage:true,errorTitle:'Select a status',error:'Use the dropdown values.'};}
 }
 style(s,45,5);s.getColumn(10).width=42;s.getColumn(13).width=35;
 for(let n=6;n<=s.rowCount;n++){for(let c=1;c<=13;c++)s.getCell(n,c).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF2CC'}};for(let c=14;c<=45;c++)s.getCell(n,c).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEAF3FA'}};}
 for(const [key] of bulkPhases){const c=phaseCols[key],letter=columnKey(c-1),status=columnKey(c);if(s.rowCount>=6)s.addConditionalFormatting({ref:`${letter}6:${status}${s.rowCount}`,rules:[{type:'expression',priority:1,formulae:[`AND(ISNUMBER(${letter}6),${letter}6<TODAY(),${status}6<>"APPROVED",${status}6<>"RECEIVED",${status}6<>"COMPLETED",${status}6<>"SHIPPED",${status}6<>"NOT REQUIRED")`],style:{font:{color:{argb:'FFB42318'}},fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FFFEE4E2'}}}}]});}
 const total=data.reduce((n,r)=>n+r.quantity,0),poCount=new Set(data.map(r=>r.poNumber)).size,pending=data.filter(r=>r.sourceIssue),last=s.rowCount;
 const control=w.addWorksheet('CONTROL');control.addRows([['WEEKLY UPDATE CONTROL'],['Supplier Name','Reporting Date','Weekly Declaration','Supplier Note'],["SPORTS KITE INTERNATIONAL CO., LTD.",dateValue(week),'',pending.length?'Includes clearly marked pending colour / quantity reconciliation rows.':''],[],['TOTAL PO COUNT',poCount],['TOTAL ORDER QUANTITY',total],['CURRENT BULK QUANTITY CHECK',{formula:last>=6?`SUM('CURRENT BULK'!I6:I${last})`:'0',result:total}],['PENDING BREAKDOWN ROWS',pending.length],['PENDING BREAKDOWN QUANTITY',pending.reduce((n,r)=>n+r.quantity,0)]]);style(control,4,2);
 const reconciliation=w.addWorksheet('ORDER RECONCILIATION');reconciliation.addRow(['PO NUMBER','STYLE','ORDER QUANTITY','BREAKDOWN STATUS']);
 const groups=new Map<string,{po:string;style:string;quantity:number;pending:boolean}>();
 for(const r of data){const key=JSON.stringify([r.poNumber,r.itemNo]);const group=groups.get(key)||{po:r.poNumber,style:r.itemNo,quantity:0,pending:false};group.quantity+=r.quantity;group.pending ||= !!r.sourceIssue;groups.set(key,group);}
 for(const g of groups.values())reconciliation.addRow([g.po,g.style,g.quantity,g.pending?'TO BE CONFIRMED':'COLOUR BREAKDOWN CHECKED']);style(reconciliation,4,1);
 return w;
}
