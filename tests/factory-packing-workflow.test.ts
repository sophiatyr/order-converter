import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import {factoryPackingGroups,factoryPackingWorkbook,parseFactoryPackingWorkbook} from '../src/utils/factoryPackingWorkbook';
import {createContainerOrders,deleteContainerBatch,restoreContainerBatch} from '../src/utils/containerShipments';
import {withCartons} from '../src/utils/shipmentPacking';
import {emptyWorkspace,shipmentQuantity,shipmentIssues} from '../src/utils/workspace';
import {withShipmentLcs,lcForLine} from '../src/utils/shipmentLc';
import {shippingDescription} from '../src/utils/shippingDescription';
import {factoryNotices} from '../src/utils/factoryNotice';
import {containerBookingRecipe,cisalfaShippingRecipe} from '../src/utils/shippingNativeRecipes';
const source=JSON.parse(fs.readFileSync('public/csq-workspace-references.json','utf8')).orders.find((o:any)=>o.poNumber==='26OF028471');
const orders=[structuredClone(source),structuredClone(source)];
orders.forEach((o,i)=>{o.poNumber='TEST-PACK-'+i;o.piNumber='TEST-SC-'+i;o.packingType=i?'MULTIPLE PACK':'NORMAL PACK';o.factorySupplier='RJ';o.port='XIAMEN';o.items=o.items.slice(0,1);const item=o.items[0];item.sizes=['S','M'];item.colors=item.colors.slice(0,1);item.factoryProduct=undefined;item.orderMultipleBySize={S:1,M:2};item.colors[0].ratioBySize={S:1,M:2};item.colors[0].quantitiesBySize={S:100,M:100};item.colors[0].totalQuantity=200;item.totalQuantity=200;o.totalPieces=200;});
let id=0;const shipments=createContainerOrders(orders,[],()=>`packing-${++id}`),original=JSON.stringify(shipments),groups=factoryPackingGroups(shipments,null);assert.equal(groups.length,1);assert.equal(groups[0].shipments.length,2);
const estimate=factoryPackingWorkbook(groups[0],orders,'estimate'),actual=factoryPackingWorkbook(groups[0],orders,'actual');
const bytes=new Uint8Array(await estimate.xlsx.writeBuffer()),book=XLSX.read(bytes,{type:'array',cellStyles:true});
assert.equal(book.Workbook?.Sheets?.find(s=>s.name==='_CSQ')?.Hidden,2);
const meta=XLSX.utils.sheet_to_json<any[]>(book.Sheets._CSQ,{header:1}).slice(1).map(r=>JSON.parse(r[0]));assert.equal(meta.length,2);
for(const m of meta){const ws=book.Sheets[m.sheet],r=m.first,n=m.n,multi=m.mode==='multiple',nw=multi?13+2*n:10+n;const set=(c:number,v:unknown)=>ws[XLSX.utils.encode_cell({r:r-1,c:c-1})]={t:'n',v} as XLSX.CellObject;set(1,1);set(3,2);set(8,multi?1:10);set(9,multi?2:20);if(multi)set(9+n,10);set(nw,8);set(nw+2,9);set(nw+4,50);set(nw+5,40);set(nw+6,30);
 const es=estimate.getWorksheet(m.sheet)!,as=actual.getWorksheet(m.sheet)!;assert.equal(es.getCell(r,1).fill.type,'pattern');assert.equal((es.getCell(r,1).fill as ExcelJS.FillPattern).fgColor?.argb,'FFFFF2CC');assert.deepEqual(es.getCell(r,4).value,as.getCell(r,4).value);assert(es.getCell(r,4).formula.includes('C'+r));}
const parsed=parseFactoryPackingWorkbook(book,shipments,'actual');assert.equal(parsed.length,2);assert.equal(shipmentQuantity(parsed[0].lines[0]),60);assert.equal(shipmentQuantity(parsed[1].lines[0]),60);assert.equal(parsed[0].lines[0].cartons,2);assert.equal(parsed[1].lines[0].grossWeight,18);assert.equal(parsed[1].lines[0].cbm,.12);assert.equal(JSON.stringify(shipments),original);
const bad=structuredClone(book);bad.Sheets[meta[0].sheet]['F'+meta[0].first]={t:'s',v:'WRONG'};assert.throws(()=>parseFactoryPackingWorkbook(bad,shipments,'actual'));
const badQty=structuredClone(book);badQty.Sheets[meta[0].sheet]['H'+meta[0].first]={t:'n',v:999};assert.doesNotThrow(()=>parseFactoryPackingWorkbook(badQty,shipments,'actual'),'Actual overpacking can be read for explicit variance review');assert.throws(()=>parseFactoryPackingWorkbook(badQty,shipments,'estimate'),'Estimate remains limited by selection');
const w={...emptyWorkspace(),orders,shipments},deleted=deleteContainerBatch(w,shipments[0],'2026-10-21T00:00:00Z');assert(deleted.shipments.every(s=>s.factoryNotice?.batchDeletedAt));assert(restoreContainerBatch(deleted,shipments[0]).shipments.every(s=>!s.factoryNotice?.batchDeletedAt));assert(!w.shipments.some(s=>s.factoryNotice?.batchDeletedAt));
const lcs=parsed.map((s,i)=>withShipmentLcs({...s,factoryNotice:{...s.factoryNotice,formalPackingReviewed:'Y'}},[{number:'LC-'+i,date:'2026-10-21',bank:'BANK-'+i,lineIds:s.lines.map(l=>l.id)}]));assert.equal(lcForLine(lcs[1],lcs[1].lines[0].id),'LC-1');
const duplicate={...lcs[0],factoryNotice:{...lcs[0].factoryNotice,lcEntries:JSON.stringify([{number:'LC-X',date:'',bank:'',lineIds:lcs[0].lines.map(l=>l.id)},{number:'LC-Y',date:'',bank:'',lineIds:lcs[0].lines.map(l=>l.id)}])}};assert.throws(()=>lcForLine(duplicate,duplicate.lines[0].id));assert(shipmentIssues(duplicate,[],orders[0]).some(e=>e.includes('L/C')));
const invoice=cisalfaShippingRecipe(lcs[1],orders[1],{...w,shipments:lcs});assert.equal(invoice.sheets[0].body?.rows[0].values[7],'LC-1');
const ready=lcs.map(s=>({...s,customer:lcs[0].customer,address:lcs[0].address,factoryNotice:{...s.factoryNotice,bookingConfirmed:'Y',estimateLines:JSON.stringify([{lineId:s.lines[0].id,quantity:60,cartons:2,grossWeight:18,cbm:.12}])}}));assert(containerBookingRecipe(ready,orders,'booking').sheets[0].patches.find(p=>p[0]==='A20')?.[1]?.toString().includes('LC-1'));
const sameSku=parsed[0].lines[0],notice=factoryNotices([{...parsed[0],lines:[sameSku,{...sameSku,id:'second-colour',color:'OTHER',sizes:{S:5,M:5}}]}],null,{},orders)[0];assert.equal(notice.lines.length,1);assert.equal(notice.lines[0].quantity,70);assert.equal(notice.lines[0].description,"MEN'S 100% POLYESTER T-SHIRT (KNITTED)");assert(!notice.lines[0].description.includes('WHITE'));

const mixed=structuredClone(orders[0]);mixed.items.push({...structuredClone(mixed.items[0]),id:'kid',itemNo:'KID',sizes:['4A','6A'],colors:[{...structuredClone(mixed.items[0].colors[0]),id:'kid-colour',quantitiesBySize:{'4A':10,'6A':20},totalQuantity:30}]});
const familyShipment=createContainerOrders([mixed],[],()=>`family-${++id}`)[0],familyBook=factoryPackingWorkbook(factoryPackingGroups([familyShipment],null)[0],[mixed],'estimate');assert.equal(familyBook.worksheets.filter(s=>s.name!=='_CSQ').length,2,'Separate adult/child size families instead of a wide union of unrelated sizes');
const foreign=withCartons({...shipments[0].lines[0],id:'other-factory',supplier:'OTHER'},[{id:'other-box',from:100,to:100,sizes:{S:1,M:0},netWeight:1,grossWeight:2,cbm:.01,measurement:'10X10X100CM'}]);const partialImport=parseFactoryPackingWorkbook(book,[{...shipments[0],lines:[...shipments[0].lines,foreign],factoryNotice:{...shipments[0].factoryNotice,plannedSelection:JSON.stringify({...JSON.parse(shipments[0].factoryNotice!.plannedSelection),'other-factory':{S:1,M:0}})}},shipments[1]],'actual');assert.deepEqual(partialImport[0].lines.find(l=>l.id==='other-factory'),foreign,'Importing one factory preserves another factory packing');
const complete=factoryPackingWorkbook({...groups[0],shipments:parsed},orders,'actual');await complete.xlsx.writeFile('work/factory-packing-filled-check.xlsx');await estimate.xlsx.writeFile('work/factory-packing-blank-check.xlsx');
console.log('PASS factory packing: one factory/multiple POs, same single/multiple estimate+actual layouts, yellow inputs, formulas, independent import recalculation, PO identity/quantity guards, reversible batch deletion, multiple L/C mapping, notice PO/style totals and reference descriptions.');


// Compact sizes: no reserved empty columns before totals or weights.
for(const m of meta){
 assert.equal(m.n,m.sizes.length);
 const ws=estimate.getWorksheet(m.sheet)!,header=ws.getRow(m.first-1);
 for(let c=1;c<=ws.columnCount;c++)assert.notEqual(header.getCell(c).text,'','No empty spacer header');
 assert.equal((ws.getCell(m.first,3).fill as ExcelJS.FillPattern).fgColor?.argb,'FFFFF2CC','End carton is factory input');
 assert.equal(ws.getCell(m.first,4).type,ExcelJS.ValueType.Formula,'Carton count is calculated');
 assert.notEqual((ws.getCell(m.first,4).fill as ExcelJS.FillPattern)?.fgColor?.argb,'FFFFF2CC');
}
const staleCount=structuredClone(book);staleCount.Sheets[meta[0].sheet]['D'+meta[0].first]={t:'n',v:999};
assert.equal(parseFactoryPackingWorkbook(staleCount,shipments,'actual')[0].lines[0].cartons,2,'Import computes range independently of cached box count');
const reverseRange=structuredClone(book);reverseRange.Sheets[meta[0].sheet]['A'+meta[0].first]={t:'n',v:5};
assert.throws(()=>parseFactoryPackingWorkbook(reverseRange,shipments,'actual'),/箱號/);
const legacy=XLSX.utils.book_new(),lm={...meta[0],sheet:'Legacy',first:10,last:10,n:6};
const legacySheet=XLSX.utils.aoa_to_sheet([]),legacyMeta=XLSX.utils.aoa_to_sheet([['CSQ_FACTORY_PACKING_V1'],[JSON.stringify(lm)]]);
for(const [a,v] of Object.entries({A3:lm.sc+' '+lm.po,A10:1,D10:2,F10:lm.sku,G10:lm.color,H10:10,I10:20,P10:8,R10:9,T10:50,U10:40,V10:30}))legacySheet[a]={v,t:typeof v==='number'?'n':'s'};
XLSX.utils.book_append_sheet(legacy,legacySheet,'Legacy');XLSX.utils.book_append_sheet(legacy,legacyMeta,'_CSQ');
assert.equal(parseFactoryPackingWorkbook(legacy,shipments,'actual')[0].lines[0].cartons,2,'Previously exported V1 box-count inputs still import');
console.log('PASS compact packing V2: actual size columns only, start/end yellow inputs, calculated count, stale-cache independence, reversed range guard and legacy V1 import.');

for(const workbook of [estimate,actual])for(const m of meta){
 const sheet=workbook.getWorksheet(m.sheet)!;
 assert.equal(sheet.getCell('A3').text,`P/I: ${m.sc}    PO: ${m.po}    Invoice: ${m.sc}`);
 assert(sheet.getCell('A4').text.startsWith('淡黃色'));
 assert(sheet.getCell('A5').text.includes('實際可溢裝／短裝'));
 assert.equal(m.first,11,'Two reference rows precede the header and carton inputs');
 assert.equal(sheet.pageSetup.printTitlesRow,'1:5');
}
assert(shipments.every(s=>s.invoiceNo===s.scNumber),'New shipment invoice defaults to PI number');
console.log('PASS factory headers: Invoice equals PI, vessel/container/LC row removed, formulas and import map follow shifted rows.');

for(const m of meta){
 const ws=estimate.getWorksheet(m.sheet)!,as=actual.getWorksheet(m.sheet)!,multi=m.mode==='multiple',sizeCol=multi?13+m.n:8,totalCol=multi?12+m.n:9+m.n;
 assert.equal(ws.getCell(m.first-3,1).text,'PO 下單數（PCS）');
 assert.equal(ws.getCell(m.first-3,sizeCol).value,100,'PO reference uses original color/size pieces, not mixed-pack ratios');
 assert.equal(ws.getCell(m.first-3,sizeCol+1).value,100);
 assert.equal(ws.getCell(m.first-3,totalCol).value,200);
 assert.equal(ws.getCell(m.first-2,sizeCol).value,100);
 assert.equal(ws.getCell(m.first-2,totalCol).value,200);
 assert.deepEqual(ws.getCell(m.first-3,sizeCol).value,as.getCell(m.first-3,sizeCol).value);
 assert(ws.getCell(m.last+1,sizeCol).formula.includes(multi?'SUM(':'SUMPRODUCT('));
}
const partial=structuredClone(groups[0]);partial.shipments[0].factoryNotice!.plannedSelection=JSON.stringify({[partial.shipments[0].lines[0].id]:{S:30,M:40}});partial.shipments[0].lines[0].planned=70;
const partialBook=factoryPackingWorkbook(partial,orders,'estimate'),partialSheet=partialBook.worksheets[0];
assert.equal(partialSheet.getCell('H8').value,100,'Original PO reference remains 100');assert.equal(partialSheet.getCell('H9').value,30,'Selected partial shipment is distinct from PO');
assert.equal(partialSheet.getCell('I9').value,40);assert.equal(partialSheet.getCell('K9').value,70);
console.log('PASS packing size references: original PO quantities, separate partial-shipment quantities, matching single/multiple columns, size total formulas and unchanged import.');




