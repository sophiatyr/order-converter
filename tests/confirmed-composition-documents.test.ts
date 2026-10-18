import assert from 'node:assert/strict';
import fs from 'node:fs';
import ExcelJS from 'exceljs';
import {buildReferenceDocument} from '../src/utils/referenceDocuments';
import {withErpPiMaterials} from '../src/utils/piMaterials';
import {correctOrderItems} from '../src/utils/orderCorrections';
import {emptyWorkspace} from '../src/utils/workspace';
import {normalizeCsqOrder} from '../src/utils/csqAccount';
import {applyErpProducts,erpFactoryOrders} from '../src/utils/erpProducts';
const templates=JSON.parse(fs.readFileSync('public/csq-document-templates.json','utf8'));
const erp=JSON.parse(fs.readFileSync('public/erp-products.json','utf8'));
const source=JSON.parse(fs.readFileSync('public/csq-workspace-references.json','utf8')).orders.find((o:any)=>o.poNumber==='26OF030603');
const order=normalizeCsqOrder({...source,items:source.items.filter((i:any)=>i.itemNo==='ATW092S27')});
const corrected='75% NYLON 25% ELASTANE',old='90% POLIAMMIDE 10%ELASTANE';
assert.ok(erp.products.find((p:any)=>p.itemNo==='ATW092S27').chineseSpec.includes(old));
const manual=correctOrderItems(order,order.items.map(i=>i.id),{description:corrected},'客人確認原始成分誤植','2026-10-18');
const before=JSON.stringify(manual),notes={...emptyWorkspace(),productNotes:{ATW092S27:{brand:'ARENA',season:'SS27',remarks:'',spec:'100% POLYESTER PRODUCT MATERIAL'}}};
assert.equal(withErpPiMaterials(manual,erp,notes).items[0].description,corrected,'Order correction beats both product and ERP');
assert.equal(withErpPiMaterials(order,erp,notes).items[0].description,notes.productNotes.ATW092S27.spec,'Maintained product beats ERP');
assert.equal(withErpPiMaterials(order,null,notes).items[0].description,notes.productNotes.ATW092S27.spec,'Maintained product works without an ERP snapshot');
const autoNote={...notes,productNotes:{ATW092S27:{...notes.productNotes.ATW092S27,createdFromPo:source.poNumber}}};assert.equal(withErpPiMaterials(order,erp,autoNote).items[0].compositionSource,'erp','Auto-created PO material is not a manual master correction');
const apply=applyErpProducts(manual,erp).order;
for(const kind of ['pi','quantity','factory'] as const){
 const value=kind==='factory'?erpFactoryOrders(apply)[0].order:apply;
 const book=buildReferenceDocument(templates,kind,value,[],erp,notes).book;
 const restored=new ExcelJS.Workbook();await restored.xlsx.load(await book.xlsx.writeBuffer());
 for(const check of [book,restored]){let texts:string[]=[];check.worksheets.forEach(ws=>ws.eachRow(row=>row.eachCell(cell=>{if(!cell.isMerged||cell.master.address===cell.address)texts.push(cell.text);})));assert.ok(texts.some(t=>t.includes(corrected)),`${kind} uses corrected composition`);assert.ok(!texts.some(t=>t.includes(old)),`${kind} must not reintroduce incorrect ERP composition`);}
}
assert.equal(JSON.stringify(manual),before,'Generating documents must not mutate the stored correction or original evidence');
assert.equal(manual.totalPieces,order.totalPieces);assert.equal(manual.totalAmountUSD,order.totalAmountUSD);
console.log('PASS: actual ATW092S27 original/ERP conflict, confirmed correction priority, product corrections, refreshed factory quotes, P/I/quantity/factory previews and XLSX roundtrip, unchanged quantities/prices/audit.');
