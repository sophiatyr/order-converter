import assert from 'node:assert/strict';import fs from 'node:fs';import ExcelJS from 'exceljs';
import {emptyWorkspace,trackingRows,type Workspace} from '../src/utils/workspace';
import {buildShipmentTracking,shipmentTrackingVisibleData,type ShipmentTrackingTemplate} from '../src/utils/shipmentTracking';
import {planShipmentTrackingImport,applyShipmentTrackingChanges} from '../src/utils/shipmentTrackingImport';
const refs=JSON.parse(fs.readFileSync('public/csq-workspace-references.json','utf8')),template:ShipmentTrackingTemplate=JSON.parse(fs.readFileSync('public/csq-shipment-template.json','utf8'));
const base=trackingRows(emptyWorkspace(),refs).find(r=>r.season==='SS27')!;
const rows=[{...base,id:'one',bulk:{},itemNo:'TEST-A'},{...base,id:'two',bulk:{},itemNo:'TEST-B'},{...base,id:'three',poNumber:'OTHER',scNumber:'CS-OTHER',bulk:{},itemNo:'TEST-C'}],w=emptyWorkspace();
const book=buildShipmentTracking(rows,w,template),sheet=book.getWorksheet('CSQ')!;
const bytes=async()=>new Uint8Array(await book.xlsx.writeBuffer());
assert.equal(sheet.getCell('G8').value,'');assert.equal(sheet.getCell('G9').value,'');
for(let c=1;c<=12;c++)assert.deepEqual(sheet.getCell(8,c).font.color,sheet.getCell(9,c).font.color,'Same PO has one font color across all cells');assert.notDeepEqual(sheet.getCell('A8').font.color,sheet.getCell('A10').font.color,'Adjacent POs have distinct colors');
assert(!Array.from({length:12},(_,c)=>sheet.getCell(7,c+1).text).some(t=>['FM','PRODUCTION SITUATION'].includes(t)));
assert.equal(sheet.getCell('K8').fill.type,'pattern');assert.equal(sheet.getCell('E11').formula,'SUM(E8:E10)');
assert.deepEqual(planShipmentTrackingImport(await bytes(),rows,w).changes,[],'Unchanged export produces no edits');
sheet.getCell('G8').value=new Date('2027-02-02T00:00:00Z');sheet.getCell('H8').value=12;sheet.getCell('I8').value=120.5;sheet.getCell('J8').value=.8;sheet.getCell('L8').value='LC-100';
const plan=planShipmentTrackingImport(await bytes(),rows,w);assert.deepEqual(plan.errors,[]);assert.equal(plan.changes.length,6);
const updated=applyShipmentTrackingChanges(w,plan),latest=rows.map(r=>({...r,bulk:{...r.bulk,...updated.tracking[r.id]?.bulk}}));const d=shipmentTrackingVisibleData(latest,updated);assert.equal(d[0].values[6],'2027-02-02');assert.equal(d[0].values[7],12);assert.equal(d[0].values[10],base.supplierCode||base.supplier);assert.equal(d[1].values[10],base.supplierCode||base.supplier);assert.equal(d[1].values[11],'LC-100');
assert.equal(updated.orders.length,0);assert.deepEqual(updated.shipments,w.shipments);assert.equal(planShipmentTrackingImport(await bytes(),latest,updated).changes.length,0,'Reimport is idempotent');
const conflictRows=rows.map(r=>r.id==='one'?{...r,bulk:{shipmentEstimatedDate:'2027-03-03'}}:r);assert(planShipmentTrackingImport(await bytes(),conflictRows,w).errors.some(e=>e.includes('其他修改')),'Concurrent edits must not be overwritten');
sheet.getCell('H8').value=-1;assert(planShipmentTrackingImport(await bytes(),rows,w).errors.some(e=>e.includes('非負')));sheet.getCell('H8').value=12;
sheet.getCell('G8').value='2027-02-30';assert(planShipmentTrackingImport(await bytes(),rows,w).errors.some(e=>e.includes('日期')));sheet.getCell('G8').value='2027-02-02';
sheet.getCell('E8').value=999;assert(planShipmentTrackingImport(await bytes(),rows,w).errors.some(e=>e.includes('數量')));sheet.getCell('E8').value=rows[0].quantity;
sheet.getCell('C8').value='WRONG';assert(planShipmentTrackingImport(await bytes(),rows,w).errors.some(e=>e.includes('找不到')));sheet.getCell('C8').value=rows[0].poNumber;
sheet.getCell('K8').value={formula:'HYPERLINK("x")',result:'x'};assert(planShipmentTrackingImport(await bytes(),rows,w).errors.some(e=>e.includes('公式')));sheet.getCell('K8').value='Factory ready';
const confirmed:Workspace={...w,shipments:[{id:'s',confirmed:true,poNumber:rows[0].poNumber,scNumber:rows[0].scNumber,lines:[{itemNo:'TEST-A',sizes:{S:10}}]} as any]};assert(planShipmentTrackingImport(await bytes(),rows,confirmed).errors.some(e=>e.includes('正式出貨')));
const duplicateBook=new ExcelJS.Workbook();await duplicateBook.xlsx.load(await book.xlsx.writeBuffer());const dup=duplicateBook.getWorksheet('CSQ')!;for(let c=1;c<=12;c++)dup.getCell(9,c).value=dup.getCell(8,c).value;assert(planShipmentTrackingImport(new Uint8Array(await duplicateBook.xlsx.writeBuffer()),rows,w).errors.some(e=>e.includes('重複')));
const sockRows=[{...rows[0],id:'sockS',itemNo:'SOCK-S'},{...rows[0],id:'sockM',itemNo:'SOCK-M'}],sockBook=buildShipmentTracking(sockRows,w,template);sockBook.getWorksheet('CSQ')!.getCell('H8').value=8;const sockPlan=planShipmentTrackingImport(new Uint8Array(await sockBook.xlsx.writeBuffer()),sockRows,w);assert.deepEqual(sockPlan.errors,[]);assert.equal(sockPlan.changes.filter(c=>c.field==='shipmentCartons').length,2,'Shared metrics update all size variants');
await book.xlsx.writeFile('work/shipment-tracking-roundtrip-check.xlsx');
console.log('PASS shipment tracking roundtrip: 12 columns, blank estimated date, PO font grouping, Excel dates/numbers, editable fills, totals, safe pairing, conflict/quantity/duplicate/formula/actual guards and shared size totals.');

await buildShipmentTracking(trackingRows(emptyWorkspace(),refs).filter(r=>r.season==='SS27').slice(0,20),w,template,{referenceOrders:refs.orders}).xlsx.writeFile('work/shipment-tracking-layout-check.xlsx');


sheet.getCell('L9').value='DIFFERENT-LC';assert(planShipmentTrackingImport(await bytes(),rows,w).errors.some(e=>e.includes('不同 L/C')),'Different LC edits within one PO need exception handling');
