import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyBulkProgress,type BulkProgressSnapshot} from '../src/utils/bulkProgress';
import {trackingRows,emptyWorkspace,type ReferenceSnapshot} from '../src/utils/workspace';
import {completeCustomerRows,buildCustomerBulk} from '../src/utils/trackingDocuments';
import {bulkPhases} from '../src/utils/trackingFields';
const refs=JSON.parse(fs.readFileSync('public/csq-workspace-references.json','utf8')) as ReferenceSnapshot;
const progress=JSON.parse(fs.readFileSync('public/csq-bulk-progress.json','utf8')) as BulkProgressSnapshot;
const applied=applyBulkProgress(refs.tracking,progress);
assert.equal(applied.matched,280);assert.equal(applied.issues.length,2);
const base=trackingRows(emptyWorkspace(),{...refs,tracking:applied.rows}).filter(r=>r.season==='SS27');
assert.equal(new Set(base.map(r=>r.poNumber)).size,93);assert.equal(base.reduce((n,r)=>n+r.quantity,0),644397);
const colors=completeCustomerRows(base,refs.orders),book=buildCustomerBulk(colors,[],'2026-10-12'),ws=book.getWorksheet('CURRENT BULK')!;
for(const [i,r] of colors.entries()){
 const source=progress.rows.find(s=>String(s.row)===r.bulk?._bulkSourceRow)!;assert.ok(source,`${r.poNumber} ${r.itemNo} must retain source provenance`);
 let col=14;
 for(const [phase] of bulkPhases){if(phase==='cutting')col++;
  const status=String(ws.getCell(i+6,col+1).value||'');assert.equal(status,source.fields[phase+'Status'],`${r.poNumber} ${r.itemNo} ${phase} status`);
  const value=ws.getCell(i+6,col).value,expected=source.fields[phase+'Date'];assert.equal(value instanceof Date?value.toISOString().slice(0,10):String(value||''),expected,`${r.poNumber} ${r.itemNo} ${phase} date`);
  col+=phase==='shippingSample'?3:2;
 }
}
const r=base.find(r=>r.poNumber==='26OF028471'&&r.itemNo==='ABCTM030CO')!;
assert.equal(r.bulk?.fabricTestDate,'2026-09-30');assert.equal(r.bulk?.fabricTestStatus,'APPROVED');assert.equal(r.bulk?.ppsDate,'2026-07-31');assert.equal(r.bulk?.ppsStatus,'APPROVED');assert.equal(r.bulk?.contact,'MARTA LONGHI');assert.equal(r.bulk?.shipmentStatus,'PLANNED');assert.equal(r.status,'尚未出貨');
const revised=trackingRows({...emptyWorkspace(),tracking:{[r.id]:{bulk:{fabricTestStatus:'ISSUE TO RESOLVE'}}}},refs).find(x=>x.id===r.id)!;assert.equal(revised.bulk?.fabricTestStatus,'ISSUE TO RESOLVE','Explicit user updates remain authoritative');
await book.xlsx.writeFile('work/customer-bulk-reconciled.xlsx');
console.log(`Original Bulk Status: all ${colors.length} export rows × 15 stage dates/statuses reconciled; 280 styles, 93 POs, 644397 pieces, planned dates and user overrides verified.`);
