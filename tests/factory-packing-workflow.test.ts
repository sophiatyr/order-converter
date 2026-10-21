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
for(const m of meta){const ws=book.Sheets[m.sheet],r=m.first,n=m.n,multi=m.mode==='multiple',nw=multi?13+2*n:10+n;const set=(c:number,v:unknown)=>ws[XLSX.utils.encode_cell({r:r-1,c:c-1})]={t:'n',v} as XLSX.CellObject;set(1,1);set(4,2);set(8,multi?1:10);set(9,multi?2:20);if(multi)set(9+n,10);set(nw,8);set(nw+2,9);set(nw+4,50);set(nw+5,40);set(nw+6,30);
 const es=estimate.getWorksheet(m.sheet)!,as=actual.getWorksheet(m.sheet)!;assert.equal(es.getCell(r,1).fill.type,'pattern');assert.equal((es.getCell(r,1).fill as ExcelJS.FillPattern).fgColor?.argb,'FFFFF2CC');assert.deepEqual(es.getCell(r,3).value,as.getCell(r,3).value);assert(es.getCell(r,3).formula.includes('D'+r));}
const parsed=parseFactoryPackingWorkbook(book,shipments,'actual');assert.equal(parsed.length,2);assert.equal(shipmentQuantity(parsed[0].lines[0]),60);assert.equal(shipmentQuantity(parsed[1].lines[0]),60);assert.equal(parsed[0].lines[0].cartons,2);assert.equal(parsed[1].lines[0].grossWeight,18);assert.equal(parsed[1].lines[0].cbm,.12);assert.equal(JSON.stringify(shipments),original);
const bad=structuredClone(book);bad.Sheets[meta[0].sheet]['F'+meta[0].first]={t:'s',v:'WRONG'};assert.throws(()=>parseFactoryPackingWorkbook(bad,shipments,'actual'));
const badQty=structuredClone(book);badQty.Sheets[meta[0].sheet]['H'+meta[0].first]={t:'n',v:999};assert.throws(()=>parseFactoryPackingWorkbook(badQty,shipments,'actual'));
const w={...emptyWorkspace(),orders,shipments},deleted=deleteContainerBatch(w,shipments[0],'2026-10-21T00:00:00Z');assert(deleted.shipments.every(s=>s.factoryNotice?.batchDeletedAt));assert(restoreContainerBatch(deleted,shipments[0]).shipments.every(s=>!s.factoryNotice?.batchDeletedAt));assert(!w.shipments.some(s=>s.factoryNotice?.batchDeletedAt));
const lcs=parsed.map((s,i)=>withShipmentLcs({...s,factoryNotice:{...s.factoryNotice,formalPackingReviewed:'Y'}},[{number:'LC-'+i,date:'2026-10-21',bank:'BANK-'+i,lineIds:s.lines.map(l=>l.id)}]));assert.equal(lcForLine(lcs[1],lcs[1].lines[0].id),'LC-1');
const duplicate=withShipmentLcs(lcs[0],[{number:'LC-X',date:'',bank:'',lineIds:lcs[0].lines.map(l=>l.id)},{number:'LC-Y',date:'',bank:'',lineIds:lcs[0].lines.map(l=>l.id)}]);assert.throws(()=>lcForLine(duplicate,duplicate.lines[0].id));assert(shipmentIssues(duplicate,[],orders[0]).some(e=>e.includes('L/C')));
const invoice=cisalfaShippingRecipe(lcs[1],orders[1],{...w,shipments:lcs});assert.equal(invoice.sheets[0].body?.rows[0].values[7],'LC-1');
const ready=lcs.map(s=>({...s,customer:lcs[0].customer,address:lcs[0].address,factoryNotice:{...s.factoryNotice,bookingConfirmed:'Y',estimateLines:JSON.stringify([{lineId:s.lines[0].id,quantity:60,cartons:2,grossWeight:18,cbm:.12}])}}));assert(containerBookingRecipe(ready,orders,'booking').sheets[0].patches.find(p=>p[0]==='A20')?.[1]?.toString().includes('LC-1'));
const sameSku=parsed[0].lines[0],notice=factoryNotices([{...parsed[0],lines:[sameSku,{...sameSku,id:'second-colour',color:'OTHER',sizes:{S:5,M:5}}]}],null,{},orders)[0];assert.equal(notice.lines.length,1);assert.equal(notice.lines[0].quantity,70);assert.equal(notice.lines[0].description,"MEN'S 100% POLYESTER T-SHIRT (KNITTED)");assert(!notice.lines[0].description.includes('WHITE'));

const mixed=structuredClone(orders[0]);mixed.items.push({...structuredClone(mixed.items[0]),id:'kid',itemNo:'KID',sizes:['4A','6A'],colors:[{...structuredClone(mixed.items[0].colors[0]),id:'kid-colour',quantitiesBySize:{'4A':10,'6A':20},totalQuantity:30}]});
const familyShipment=createContainerOrders([mixed],[],()=>`family-${++id}`)[0],familyBook=factoryPackingWorkbook(factoryPackingGroups([familyShipment],null)[0],[mixed],'estimate');assert.equal(familyBook.worksheets.filter(s=>s.name!=='_CSQ').length,2,'Separate adult/child size families instead of a wide union of unrelated sizes');
const foreign=withCartons({...shipments[0].lines[0],id:'other-factory',supplier:'OTHER'},[{id:'other-box',from:100,to:100,sizes:{S:1,M:0},netWeight:1,grossWeight:2,cbm:.01,measurement:'10X10X100CM'}]);const partialImport=parseFactoryPackingWorkbook(book,[{...shipments[0],lines:[...shipments[0].lines,foreign],factoryNotice:{...shipments[0].factoryNotice,plannedSelection:JSON.stringify({...JSON.parse(shipments[0].factoryNotice!.plannedSelection),'other-factory':{S:1,M:0}})}},shipments[1]],'actual');assert.deepEqual(partialImport[0].lines.find(l=>l.id==='other-factory'),foreign,'Importing one factory preserves another factory packing');
const complete=factoryPackingWorkbook({...groups[0],shipments:parsed},orders,'actual');await complete.xlsx.writeFile('work/factory-packing-filled-check.xlsx');await estimate.xlsx.writeFile('work/factory-packing-blank-check.xlsx');
console.log('PASS factory packing: one factory/multiple POs, same single/multiple estimate+actual layouts, yellow inputs, formulas, independent import recalculation, PO identity/quantity guards, reversible batch deletion, multiple L/C mapping, notice PO/style totals and reference descriptions.');

